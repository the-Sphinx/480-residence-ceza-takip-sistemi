const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DOCS_API = 'https://docs.googleapis.com/v1/documents';

const TEMPLATE_DOC_ID = import.meta.env.VITE_TUTANAK_TEMPLATE_DOC_ID;
const FOLDER_ID = import.meta.env.VITE_TUTANAKLAR_FOLDER_ID;

export interface TutanakData {
  resident: string;
  blockId: string;
  unitNo: string;
  date: string;
  time: string;
  location: string;
  fineNo: string;
  fineDescription: string;
  fineType: string;
  fineAmount: string;
}

async function apiRequest(
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

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API hatası (${response.status}): ${body}`);
  }

  return response;
}

async function copyTemplate(token: string, fileName: string): Promise<string> {
  const url = `${DRIVE_API}/${TEMPLATE_DOC_ID}/copy`;
  const response = await apiRequest(url, token, {
    method: 'POST',
    body: JSON.stringify({
      name: fileName,
      parents: [FOLDER_ID],
    }),
  });
  const data = await response.json();
  return data.id;
}

async function fillTemplate(
  token: string,
  docId: string,
  data: TutanakData,
): Promise<void> {
  const replacements: Record<string, string> = {
    '@Resident@': data.resident,
    '@BlokId@': data.blockId,
    '@UnitNo@': data.unitNo,
    '@Date@': data.date,
    '@Time@': data.time,
    '@Location@': data.location,
    '@FineNo@': data.fineNo,
    '@FineDescription@': data.fineDescription,
    '@FineType@': data.fineType,
    '@FineAmount@': data.fineAmount,
  };

  const requests = Object.entries(replacements).map(([placeholder, value]) => ({
    replaceAllText: {
      containsText: {
        text: placeholder,
        matchCase: true,
      },
      replaceText: value,
    },
  }));

  const url = `${DOCS_API}/${docId}:batchUpdate`;
  await apiRequest(url, token, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });
}

export async function generateTutanak(
  token: string,
  data: TutanakData,
  fileName: string,
): Promise<string> {
  const docId = await copyTemplate(token, fileName);
  await fillTemplate(token, docId, data);
  return `https://docs.google.com/document/d/${docId}/edit`;
}
