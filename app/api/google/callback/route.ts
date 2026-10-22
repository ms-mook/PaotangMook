import { cookies } from "next/headers";
import { createStorage, exchangeToken } from "@/lib/google";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(body: string) {
  return new Response(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ตั้งค่า Google</title><style>
body{font-family:system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;line-height:1.6;color:#1d2a26}
code{display:block;background:#f1f4f2;padding:10px;border-radius:8px;word-break:break-all;margin:4px 0 14px;user-select:all}
b{color:#0b6b52}</style></head><body>${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  if (!code || !state || jar.get("pt_oauth_state")?.value !== state) {
    return page(`<h2>ลิงก์หมดอายุหรือไม่ถูกต้อง</h2><p><a href="/setup">ลองใหม่</a></p>`);
  }
  try {
    const tok = await exchangeToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${url.origin}/api/google/callback`,
    });
    if (!tok.refresh_token) {
      return page(`<h2>Google ไม่ได้ส่ง refresh token มา</h2>
<p>ให้ไปที่ <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> ลบสิทธิ์ของแอปนี้ แล้ว<a href="/setup">ลองใหม่</a></p>`);
    }

    let storage = "";
    if (!process.env.SHEET_ID || !process.env.DRIVE_FOLDER_ID) {
      const s = await createStorage(tok.access_token);
      storage = `<p>สร้างไฟล์ใน Google Drive ของคุณแล้ว:
<a href="${esc(s.sheetUrl)}" target="_blank">ชีตรายการ</a> · <a href="${esc(s.folderUrl)}" target="_blank">โฟลเดอร์สลิป</a></p>
<b>SHEET_ID</b><code>${esc(s.sheetId)}</code>
<b>DRIVE_FOLDER_ID</b><code>${esc(s.folderId)}</code>`;
    } else {
      storage = `<p>ใช้ SHEET_ID และ DRIVE_FOLDER_ID เดิมที่ตั้งไว้แล้ว</p>`;
    }

    return page(`<h2>เชื่อม Google สำเร็จ ✅</h2>
<p>นำค่าด้านล่างไปใส่ใน Vercel → Project → Settings → Environment Variables แล้วกด Redeploy</p>
<b>GOOGLE_REFRESH_TOKEN</b><code>${esc(tok.refresh_token)}</code>
${storage}
<p style="color:#a33">ค่าเหล่านี้เป็นความลับ อย่าแชร์หรือ commit ลง GitHub</p>`);
  } catch (e) {
    return page(`<h2>เกิดข้อผิดพลาด</h2><code>${esc((e as Error).message)}</code><p><a href="/setup">ลองใหม่</a></p>`);
  }
}
