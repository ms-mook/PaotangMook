// Minimal Google Drive + Sheets client over REST (no googleapis dependency).
// Auth: OAuth refresh token of the owner's own Google account, scope drive.file
// (the app can only see files it created itself: the sheet and the slip folder).

export const SCOPE = "https://www.googleapis.com/auth/drive.file";
export const SHEET_TAB = "รายการ";
export const HEADERS = [
  "id",
  "createdAt",
  "date",
  "type",
  "amount",
  "category",
  "note",
  "bank",
  "transRef",
  "slipFileId",
];

export type TxType = "income" | "expense";
export interface Tx {
  id: string;
  createdAt: string;
  date: string; // YYYY-MM-DD
  type: TxType;
  amount: number;
  category: string;
  note: string;
  bank: string;
  transRef: string;
  slipFileId: string;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`ยังไม่ได้ตั้งค่า ${name}`);
  return v;
}

let cached: { token: string; exp: number } | null = null;

export async function exchangeToken(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      ...params,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${data.error_description || data.error}`);
  return data as { access_token: string; expires_in: number; refresh_token?: string };
}

async function accessToken(override?: string): Promise<string> {
  if (override) return override;
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const data = await exchangeToken({
    grant_type: "refresh_token",
    refresh_token: env("GOOGLE_REFRESH_TOKEN"),
  });
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function g(url: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(token)}`, ...(init.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const range = (r: string) => encodeURIComponent(`'${SHEET_TAB}'!${r}`);

// ---------- Setup (first run) ----------

export async function createStorage(token: string) {
  const folder = await (
    await g(
      "https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "เป๋าตังค์ - สลิป",
          mimeType: "application/vnd.google-apps.folder",
        }),
      },
      token,
    )
  ).json();

  const sheet = await (
    await g(
      SHEETS,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: { title: "เป๋าตังค์ - รายรับรายจ่าย", locale: "th_TH", timeZone: "Asia/Bangkok" },
          sheets: [
            {
              properties: { title: SHEET_TAB, gridProperties: { frozenRowCount: 1 } },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    {
                      values: HEADERS.map((h) => ({
                        userEnteredValue: { stringValue: h },
                        userEnteredFormat: { textFormat: { bold: true } },
                      })),
                    },
                  ],
                },
              ],
            },
          ],
        }),
      },
      token,
    )
  ).json();

  return {
    folderId: folder.id as string,
    folderUrl: folder.webViewLink as string,
    sheetId: sheet.spreadsheetId as string,
    sheetUrl: sheet.spreadsheetUrl as string,
  };
}

// ---------- Transactions ----------

function rowToTx(r: string[]): Tx {
  return {
    id: r[0] || "",
    createdAt: r[1] || "",
    date: r[2] || "",
    type: (r[3] === "income" ? "income" : "expense") as TxType,
    amount: Number(String(r[4] || "0").replace(/,/g, "")) || 0,
    category: r[5] || "",
    note: r[6] || "",
    bank: r[7] || "",
    transRef: r[8] || "",
    slipFileId: r[9] || "",
  };
}

export async function listTx(): Promise<Tx[]> {
  const res = await g(`${SHEETS}/${env("SHEET_ID")}/values/${range("A2:J")}?valueRenderOption=UNFORMATTED_VALUE`);
  const data = await res.json();
  const rows: string[][] = (data.values || []).map((r: unknown[]) => r.map((c) => String(c ?? "")));
  return rows.filter((r) => r[0]).map(rowToTx);
}

export async function appendTx(tx: Tx) {
  const row = [
    tx.id,
    tx.createdAt,
    tx.date,
    tx.type,
    tx.amount,
    tx.category,
    tx.note,
    tx.bank,
    tx.transRef,
    tx.slipFileId,
  ];
  await g(
    `${SHEETS}/${env("SHEET_ID")}/values/${range("A:J")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    },
  );
}

export async function deleteTx(id: string): Promise<Tx | null> {
  const spreadsheetId = env("SHEET_ID");
  const ids = await (await g(`${SHEETS}/${spreadsheetId}/values/${range("A:A")}`)).json();
  const col: string[][] = ids.values || [];
  const rowIndex = col.findIndex((r) => r[0] === id);
  if (rowIndex < 1) return null;

  const all = await listTx();
  const tx = all.find((t) => t.id === id) || null;

  const meta = await (await g(`${SHEETS}/${spreadsheetId}?fields=sheets.properties`)).json();
  const tab = meta.sheets.find((s: { properties: { title: string } }) => s.properties.title === SHEET_TAB);
  await g(`${SHEETS}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: tab.properties.sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    }),
  });
  return tx;
}

// ---------- Slips (Drive) ----------

export async function uploadSlip(name: string, mime: string, bytes: ArrayBuffer): Promise<string> {
  const boundary = "pt" + crypto.randomUUID().replace(/-/g, "");
  const meta = JSON.stringify({ name, parents: [env("DRIVE_FOLDER_ID")] });
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = new Blob([head, new Uint8Array(bytes), tail]);
  const res = await g("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()).id as string;
}

export async function downloadSlip(fileId: string): Promise<Response> {
  return g(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
}

export async function trashSlip(fileId: string) {
  await g(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}
