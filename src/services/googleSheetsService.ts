import { google } from 'googleapis';

const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function readSheet(spreadsheetId: string, range: string) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values;
}

export async function writeToSheet(spreadsheetId: string, range: string, values: any[][]) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values,
    },
  });
}

export async function createSheet(title: string) {
  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title,
      },
    },
  });
  return response.data.spreadsheetId;
}
