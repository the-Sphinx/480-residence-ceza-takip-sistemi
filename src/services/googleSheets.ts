import type { Tenant, InfractionType, Fine, FineAmount } from '@/types';
import { parseFineAmountString, fineAmountToString } from '@/utils/formatters';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

const SHEET_NAMES = {
  tenants: 'Sakinler',
  infractions: 'CezaTurleri',
  fines: 'Cezalar',
} as const;

const HEADERS = {
  tenants: ['id', 'blockId', 'unitNo', 'fullName', 'isVacant'],
  infractions: ['id', 'name', 'description', 'category', 'isActive', 'fineAmount1', 'fineAmount2', 'fineAmount3', 'fineAmount4', 'fineAmount5'],
  fines: ['id', 'tenantId', 'infractionTypeId', 'date', 'amount', 'amountLabel', 'notes', 'isPaid', 'paidDate', 'isDeleted'],
} as const;

export { SHEET_NAMES };

// ──────────────────────────────────────────────
// Serialization helpers
// ──────────────────────────────────────────────

export function tenantToRow(t: Tenant): string[] {
  return [t.id, t.blockId, String(t.unitNo), t.fullName, String(t.isVacant)];
}

export function rowToTenant(row: string[]): Tenant {
  return {
    id: row[0],
    blockId: row[1],
    unitNo: parseInt(row[2], 10),
    fullName: row[3],
    isVacant: row[4] === 'true',
  };
}

export function infractionToRow(i: InfractionType): string[] {
  // Fixed columns: id, name, description, category, isActive
  // Variable columns: fineAmount1..N (at the end so tier count can grow)
  const row = [
    i.id, i.name, i.description,
    i.category || '', String(i.isActive),
  ];
  for (const fa of i.fineAmounts) {
    row.push(fineAmountToString(fa ?? { monetary: 0, label: '' }));
  }
  return row;
}

export function rowToInfraction(row: string[]): InfractionType {
  // Layout: id(0), name(1), description(2), category(3), isActive(4), fineAmount1(5)...
  const category = row[3] || undefined;
  const isActive = row[4] === 'true';
  const fineAmounts: FineAmount[] = [];
  for (let i = 5; i < row.length; i++) {
    if (row[i] !== undefined && row[i] !== '') {
      fineAmounts.push(parseFineAmountString(row[i]));
    }
  }
  // Ensure at least 5 tiers (fill from last if short)
  while (fineAmounts.length < 5) {
    fineAmounts.push(fineAmounts.length > 0 ? { ...fineAmounts[fineAmounts.length - 1] } : { monetary: 0, label: '' });
  }
  return { id: row[0], name: row[1], description: row[2], fineAmounts, category, isActive };
}

export function fineToRow(f: Fine): string[] {
  return [
    f.id,
    f.tenantId,
    f.infractionTypeId,
    f.date,
    String(f.amount),
    f.amountLabel || '',
    f.notes,
    String(f.isPaid),
    f.paidDate || '',
    String(f.isDeleted),
  ];
}

export function rowToFine(row: string[]): Fine {
  return {
    id: row[0],
    tenantId: row[1],
    infractionTypeId: row[2],
    date: row[3],
    amount: parseFloat(row[4]) || 0,
    amountLabel: row[5] || '',
    notes: row[6] || '',
    isPaid: row[7] === 'true',
    paidDate: row[8] || undefined,
    isDeleted: row[9] === 'true',
  };
}

// ──────────────────────────────────────────────
// API helpers
// ──────────────────────────────────────────────

async function sheetsRequest(
  url: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new SheetsError('Token süresi doldu. Lütfen tekrar giriş yapın.', 401);
  }
  if (response.status === 429) {
    throw new SheetsError('API istek limiti aşıldı. Lütfen biraz bekleyin.', 429);
  }
  if (response.status === 403) {
    throw new SheetsError('Google Sheets erişim izni verilmedi. Lütfen çıkış yapıp tekrar giriş yapın ve "Google Sheets" iznini kabul edin.', 403);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new SheetsError(`Sheets API hatası: ${response.status} - ${body}`, response.status);
  }

  return response;
}

export class SheetsError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'SheetsError';
    this.statusCode = statusCode;
  }
}

// ──────────────────────────────────────────────
// Core API operations
// ──────────────────────────────────────────────

export function getSpreadsheetIdFromEnv(): string | null {
  const url = import.meta.env.VITE_GOOGLE_SPREADSHEET_URL;
  if (!url || url === 'https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID_HERE/edit') {
    return null;
  }
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function initializeSpreadsheet(
  token: string,
  spreadsheetId: string,
): Promise<void> {
  // Get existing sheet names
  const metaUrl = `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`;
  const metaResponse = await sheetsRequest(metaUrl, token);
  const metaData = await metaResponse.json();

  const existingSheets = new Set(
    (metaData.sheets || []).map(
      (s: { properties: { title: string } }) => s.properties.title,
    ),
  );

  const requiredSheets = [
    { name: SHEET_NAMES.tenants, headers: HEADERS.tenants },
    { name: SHEET_NAMES.infractions, headers: HEADERS.infractions },
    { name: SHEET_NAMES.fines, headers: HEADERS.fines },
  ];

  const requests: object[] = [];

  for (const sheet of requiredSheets) {
    if (!existingSheets.has(sheet.name)) {
      requests.push({
        addSheet: {
          properties: { title: sheet.name },
        },
      });
    }
  }

  if (requests.length > 0) {
    await sheetsRequest(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });

    // Add headers to newly created sheets
    for (const sheet of requiredSheets) {
      if (!existingSheets.has(sheet.name)) {
        const headerUrl = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheet.name)}!A1:Z1?valueInputOption=RAW`;
        await sheetsRequest(headerUrl, token, {
          method: 'PUT',
          body: JSON.stringify({ values: [sheet.headers as unknown as string[]] }),
        });
      }
    }
  }
}

export async function readSheet<T>(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  rowMapper: (row: string[]) => T,
): Promise<T[]> {
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:Z`;
  const response = await sheetsRequest(url, token);
  const data = await response.json();

  const rows: string[][] = data.values || [];
  return rows.map(rowMapper);
}

export async function appendRow(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  values: string[],
): Promise<void> {
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:Z:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  await sheetsRequest(url, token, {
    method: 'POST',
    body: JSON.stringify({ values: [values] }),
  });
}

export async function updateRow(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  values: string[],
): Promise<void> {
  // rowIndex is 0-based data row (excluding header), so sheet row = rowIndex + 2
  const sheetRow = rowIndex + 2;
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A${sheetRow}:Z${sheetRow}?valueInputOption=RAW`;
  await sheetsRequest(url, token, {
    method: 'PUT',
    body: JSON.stringify({ values: [values] }),
  });
}

export async function findRowIndex(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  id: string,
): Promise<number> {
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:A`;
  const response = await sheetsRequest(url, token);
  const data = await response.json();

  const rows: string[][] = data.values || [];
  const index = rows.findIndex(row => row[0] === id);
  if (index === -1) throw new Error(`Row with id ${id} not found in ${sheetName}`);
  return index;
}

export async function deleteRow(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
): Promise<void> {
  // Need to get the sheet ID (gid) first
  const metaUrl = `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`;
  const metaResponse = await sheetsRequest(metaUrl, token);
  const metaData = await metaResponse.json();

  const sheet = metaData.sheets?.find(
    (s: { properties: { title: string; sheetId: number } }) => s.properties.title === sheetName,
  );
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`);

  const sheetId = sheet.properties.sheetId;
  const sheetRow = rowIndex + 1; // +1 for header (0-based in batchUpdate)

  await sheetsRequest(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: sheetRow,
            endIndex: sheetRow + 1,
          },
        },
      }],
    }),
  });
}

export async function batchWriteAll(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  rows: string[][],
): Promise<void> {
  // Clear existing data (keep header) then write all rows
  const clearUrl = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:Z:clear`;
  await sheetsRequest(clearUrl, token, { method: 'POST' });

  if (rows.length === 0) return;

  const writeUrl = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:Z?valueInputOption=RAW`;
  await sheetsRequest(writeUrl, token, {
    method: 'PUT',
    body: JSON.stringify({ values: rows }),
  });
}
