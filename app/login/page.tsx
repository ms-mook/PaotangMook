"use client";
import { Delete } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BgDeco, Piggy } from "@/components/Cute";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export default function Login() {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = useCallback(async (value: string) => {
    if (value.length < 4 || busy) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: value }),
    });
    if (res.ok) {
      location.replace("/");
      return;
    }
    setErr((await res.json().catch(() => ({}))).error || "เข้าสู่ระบบไม่สำเร็จ");
    setShake(Date.now());
    setPin("");
    setBusy(false);
  }, [busy]);

  const press = useCallback((k: string) => {
    if (busy) return;
    setErr("");
    if (k === "del") setPin((p) => p.slice(0, -1));
    else if (k) setPin((p) => (p.length < 8 ? p + k : p));
  }, [busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") submit(pin);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [press, submit, pin]);

  return (
    <>
      <BgDeco />
      <main className="login">
        <div className="login-card glass-strong pop-in">
          <Piggy size={104} mood={err ? "wow" : pin.length ? "happy" : "wink"} className="bob" />
          <h1>เป๋าตังค์</h1>
          <p>ใส่ PIN เพื่อเข้าใช้งานค่ะ</p>
          <div className={`pin-dots ${shake ? "shake" : ""}`} key={shake} aria-live="polite" aria-label={`ใส่แล้ว ${pin.length} หลัก`}>
            {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
              <i key={i} className={i < pin.length ? "on" : ""} />
            ))}
          </div>
          <div className="keypad">
            {KEYS.map((k, i) =>
              k === "" ? (
                <span key={i} />
              ) : (
                <button key={i} className={`key ${k === "del" ? "del" : ""}`} onClick={() => press(k)} aria-label={k === "del" ? "ลบ" : k}>
                  {k === "del" ? <Delete size={22} /> : k}
                </button>
              ),
            )}
          </div>
          <button className="btn key go" disabled={busy || pin.length < 4} onClick={() => submit(pin)}>
            {busy ? <span className="pulse">กำลังตรวจสอบ…</span> : "เข้าเลย 💖"}
          </button>
          {err && <div className="err pop-in" role="alert">{err} ลองใหม่นะคะ 🥺</div>}
        </div>
      </main>
    </>
  );
}
