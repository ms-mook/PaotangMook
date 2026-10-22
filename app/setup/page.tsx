import { ping } from "@/lib/store";

export const dynamic = "force-dynamic";

function Item({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li>
      {ok ? "✅" : "⬜️"} <code>{label}</code>
    </li>
  );
}

export default async function Setup() {
  const e = process.env;
  const hasScript = !!(e.APPS_SCRIPT_URL && e.APPS_SCRIPT_SECRET);
  let status: { ok: true; sheet: string; folder: string } | { ok: false; error: string } | null = null;
  if (hasScript) {
    try {
      const r = await ping();
      status = { ok: true, sheet: r.sheet, folder: r.folder };
    } catch (err) {
      status = { ok: false, error: (err as Error).message };
    }
  }

  return (
    <main className="wrap">
      <h2>สถานะการเชื่อมต่อ</h2>
      <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
        <Item ok={!!e.APP_PIN && !!e.AUTH_SECRET} label="APP_PIN / AUTH_SECRET" />
        <Item ok={!!e.APPS_SCRIPT_URL} label="APPS_SCRIPT_URL" />
        <Item ok={!!e.APPS_SCRIPT_SECRET} label="APPS_SCRIPT_SECRET" />
        <Item ok={!!status?.ok} label="เชื่อม Apps Script สำเร็จ" />
      </ul>
      {status?.ok ? (
        <p>
          พร้อมใช้งาน — <a href={status.sheet} target="_blank">เปิดชีต</a> ·{" "}
          <a href={status.folder} target="_blank">โฟลเดอร์สลิป</a> · <a href="/">ไปหน้าหลัก</a>
        </p>
      ) : status ? (
        <p className="err">{status.error}</p>
      ) : (
        <p>ตั้งค่า APPS_SCRIPT_URL และ APPS_SCRIPT_SECRET ใน Vercel แล้ว Redeploy (ดูขั้นตอนใน README)</p>
      )}
    </main>
  );
}
