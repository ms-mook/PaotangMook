export const dynamic = "force-dynamic";

function Item({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li>
      {ok ? "✅" : "⬜️"} <code>{label}</code>
    </li>
  );
}

export default function Setup() {
  const e = process.env;
  const hasClient = !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
  const ready = hasClient && !!(e.GOOGLE_REFRESH_TOKEN && e.SHEET_ID && e.DRIVE_FOLDER_ID);
  return (
    <main className="wrap">
      <h2>ตั้งค่าการเชื่อม Google</h2>
      <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
        <Item ok={!!e.APP_PIN && !!e.AUTH_SECRET} label="APP_PIN / AUTH_SECRET" />
        <Item ok={hasClient} label="GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET" />
        <Item ok={!!e.GOOGLE_REFRESH_TOKEN} label="GOOGLE_REFRESH_TOKEN" />
        <Item ok={!!e.SHEET_ID} label="SHEET_ID" />
        <Item ok={!!e.DRIVE_FOLDER_ID} label="DRIVE_FOLDER_ID" />
      </ul>
      {ready ? (
        <p>
          พร้อมใช้งานแล้ว — <a href="/">ไปหน้าหลัก</a>
        </p>
      ) : hasClient ? (
        <>
          <p>
            กดปุ่มด้านล่าง ล็อกอิน Google บัญชีที่จะเก็บสลิป แอปจะสร้างชีตและโฟลเดอร์ให้ แล้วแสดงค่าที่ต้องนำไปใส่ใน
            Vercel
          </p>
          <a className="btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href="/api/google/auth">
            เชื่อมบัญชี Google
          </a>
        </>
      ) : (
        <p>ตั้งค่า GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET ใน Vercel ก่อน แล้ว Redeploy (ดูขั้นตอนใน README)</p>
      )}
    </main>
  );
}
