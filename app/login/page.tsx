"use client";
import { useState } from "react";

export default function Login() {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      location.replace("/");
    } else {
      setErr((await res.json().catch(() => ({}))).error || "เข้าสู่ระบบไม่สำเร็จ");
      setPin("");
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" />
        <h1>เป๋าตังค์</h1>
        <p>ใส่ PIN เพื่อเข้าใช้งาน</p>
        <input
          className="in pin num"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <button className="btn" disabled={busy || pin.length < 4}>
          {busy ? "กำลังตรวจสอบ…" : "เข้าใช้งาน"}
        </button>
        {err && <div className="err">{err}</div>}
      </form>
    </main>
  );
}
