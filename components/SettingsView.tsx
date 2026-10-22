"use client";
import { useState } from "react";
import { baht } from "@/lib/format";
import { iconFor } from "@/lib/icons";
import type { Recurring, Settings, TxType } from "@/lib/types";

function TagEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  const add = () => {
    const s = v.trim();
    if (s && !items.includes(s)) onChange([...items, s]);
    setV("");
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <>
      <div className="chips">
        {items.map((c, i) => (
          <span key={c} className="chip tag">
            {i > 0 && <button className="tag-move" aria-label="เลื่อนไปข้างหน้า" onClick={() => move(i, -1)}>‹</button>}
            {c}
            <button className="tag-x" aria-label={`ลบ ${c}`} onClick={() => onChange(items.filter((x) => x !== c))}>×</button>
          </span>
        ))}
      </div>
      <div className="add-row">
        <input className="in" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="chip on" onClick={add}>เพิ่ม</button>
      </div>
    </>
  );
}

const blankRec = (s: Settings): Recurring => ({
  id: "",
  day: 1,
  type: "expense",
  amount: 0,
  category: s.expenseCategories[0] || "",
  note: "",
  account: s.accounts[0] || "",
});

interface Props {
  settings: Settings;
  scanEnabled: boolean;
  onSaved: (s: Settings) => void;
  onLogout: () => void;
}

export default function SettingsView({ settings, scanEnabled, onSaved, onLogout }: Props) {
  const [s, setS] = useState<Settings>(settings);
  const [rec, setRec] = useState<Recurring>(blankRec(settings));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  async function save(next = s) {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setS(data.settings);
      onSaved(data.settings);
      setMsg("บันทึกการตั้งค่าแล้ว ✓");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function testEmail() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/settings", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(`ส่งอีเมลทดสอบไปที่ ${data.to} แล้ว`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addRecurring() {
    if (!(rec.amount > 0)) return setErr("ใส่ยอดของรายการประจำก่อน");
    setErr("");
    set("recurring", [...s.recurring, { ...rec, id: crypto.randomUUID() }]);
    setRec(blankRec(s));
  }

  const budgetSum = Object.values(s.budgets).reduce((a, b) => a + b, 0);
  const recCats = rec.type === "income" ? s.incomeCategories : s.expenseCategories;

  return (
    <div className="settings">
      <section className="panel glass">
        <h3>💗 วงเงินใช้จ่ายต่อเดือน</h3>
        <p className="hint">รายจ่ายรวมทุกหมวดต่อเดือน — แสดงบนหน้าหลักและเตือนเมื่อใช้ถึง 80% (เว้นว่าง = ไม่จำกัด)</p>
        <div className="amount-input">
          <input
            className="num"
            inputMode="numeric"
            placeholder="ไม่จำกัด"
            value={s.monthlyLimit || ""}
            onChange={(e) => set("monthlyLimit", Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
          <span>บาท/เดือน</span>
        </div>
        {s.monthlyLimit > 0 && budgetSum > s.monthlyLimit && (
          <small className="near">งบรายหมวดรวมกัน {baht(budgetSum)} บาท มากกว่าวงเงินรวม</small>
        )}
      </section>

      <section className="panel glass">
        <h3>🌸 หมวดรายจ่าย</h3>
        <TagEditor items={s.expenseCategories} onChange={(v) => set("expenseCategories", v)} placeholder="เพิ่มหมวด เช่น ☕ กาแฟ" />
      </section>

      <section className="panel glass">
        <h3>💰 หมวดรายรับ</h3>
        <TagEditor items={s.incomeCategories} onChange={(v) => set("incomeCategories", v)} placeholder="เพิ่มหมวดรายรับ" />
      </section>

      <section className="panel glass">
        <h3>👛 บัญชี / กระเป๋า</h3>
        <p className="hint">ตั้งชื่อให้มีชื่อธนาคาร เช่น “กสิกร” หรือ “ไทยพาณิชย์” แอปจะเลือกบัญชีให้อัตโนมัติจากสลิป</p>
        <TagEditor items={s.accounts} onChange={(v) => set("accounts", v)} placeholder="เช่น เงินสด, กสิกร, ไทยพาณิชย์" />
      </section>

      <section className="panel glass">
        <h3>🎯 งบประมาณรายหมวด</h3>
        <p className="hint">เว้นว่างหมวดที่ไม่ต้องการตั้งงบ — แอปจะเตือนเมื่อใช้ถึง 80%</p>
        {s.expenseCategories.map((c) => (
          <div className="budget-input" key={c}>
            <span>{iconFor(c, "expense")} {c.replace(/^\p{Extended_Pictographic}\s*/u, "")}</span>
            <input
              className="in num"
              inputMode="numeric"
              placeholder="—"
              value={s.budgets[c] || ""}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                const b = { ...s.budgets };
                if (n > 0) b[c] = n;
                else delete b[c];
                set("budgets", b);
              }}
            />
          </div>
        ))}
      </section>

      <section className="panel glass">
        <h3>🔁 รายการประจำทุกเดือน</h3>
        <p className="hint">ลงรายการให้อัตโนมัติเมื่อถึงวันที่กำหนด (เช่น ค่าเช่า ค่าเน็ต เงินเดือน)</p>
        {s.recurring.length > 0 && (
          <div className="list flat">
            {s.recurring.map((r) => (
              <div className="row" key={r.id}>
                <span className="mid">
                  <b>{r.note || r.category}</b>
                  <small>ทุกวันที่ {r.day} · {r.category}{r.account ? ` · ${r.account}` : ""}</small>
                </span>
                <span className={`amt num ${r.type}`}>{r.type === "income" ? "+" : "−"}{baht(r.amount)}</span>
                <button className="icon-btn" aria-label="ลบ" onClick={() => set("recurring", s.recurring.filter((x) => x.id !== r.id))}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="rec-form">
          <div className="seg mini">
            {(["expense", "income"] as TxType[]).map((t) => (
              <button key={t} className={`${t} ${rec.type === t ? "on" : ""}`}
                onClick={() => setRec({ ...rec, type: t, category: (t === "income" ? s.incomeCategories : s.expenseCategories)[0] || "" })}>
                {t === "income" ? "รายรับ" : "รายจ่าย"}
              </button>
            ))}
          </div>
          <div className="rec-grid">
            <input className="in num" inputMode="decimal" placeholder="ยอด (บาท)" value={rec.amount || ""}
              onChange={(e) => setRec({ ...rec, amount: Number(e.target.value.replace(/[^\d.]/g, "")) })} />
            <select className="in" value={rec.day} onChange={(e) => setRec({ ...rec, day: Number(e.target.value) })}>
              {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>วันที่ {i + 1}</option>)}
            </select>
            <select className="in" value={rec.category} onChange={(e) => setRec({ ...rec, category: e.target.value })}>
              {recCats.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="in" value={rec.account} onChange={(e) => setRec({ ...rec, account: e.target.value })}>
              <option value="">ไม่ระบุบัญชี</option>
              {s.accounts.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <input className="in" placeholder="ชื่อรายการ เช่น ค่าเช่าห้อง" value={rec.note} onChange={(e) => setRec({ ...rec, note: e.target.value })} />
          <button className="btn ghost" onClick={addRecurring}>＋ เพิ่มรายการประจำ</button>
        </div>
      </section>

      <section className="panel glass">
        <h3>💌 สรุปทางอีเมล</h3>
        <label className="switch">
          <input type="checkbox" checked={s.weeklyEmail} onChange={(e) => set("weeklyEmail", e.target.checked)} />
          <span>ส่งสรุปรายสัปดาห์ทุกวันอาทิตย์ 19:00 ไปที่อีเมลเจ้าของชีต</span>
        </label>
        <button className="btn ghost" disabled={busy} onClick={testEmail}>ส่งอีเมลทดสอบตอนนี้</button>
      </section>

      <section className="panel glass">
        <h3>✨ AI อ่านสลิป</h3>
        {scanEnabled ? (
          <p className="ok">✓ เปิดใช้งานแล้ว — แอปจะอ่านยอด วันที่ และชื่อผู้รับจากสลิปให้อัตโนมัติ</p>
        ) : (
          <p className="hint">
            ยังไม่เปิด — ขอ API key ฟรีที่ <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>{" "}
            แล้วใส่เป็น <code>GEMINI_API_KEY</code> ใน Vercel → Redeploy
          </p>
        )}
      </section>

      <section className="panel glass links">
        <a href="/setup">🔌 ตรวจสถานะการเชื่อมต่อ</a>
        <button className="link-btn danger-text" onClick={onLogout}>🚪 ออกจากระบบ</button>
      </section>

      {msg && !dirty && <p className="ok">{msg}</p>}
      {(dirty || err) && (
        <div className="save-bar">
          {err && <div className="err">{err}</div>}
          <button className="btn" disabled={busy || !dirty} onClick={() => save()}>
            {busy ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
          </button>
        </div>
      )}
    </div>
  );
}
