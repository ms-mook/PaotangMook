"use client";
import { useEffect, useRef, useState } from "react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { prepareSlip, type Prepared } from "@/lib/image";
import { todayISO } from "@/lib/format";
import type { Tx, TxType } from "@/lib/google";

interface Props {
  initialFile?: Blob | null;
  onClose: () => void;
  onSaved: (tx: Tx) => void;
}

export default function AddSheet({ initialFile, onClose, onSaved }: Props) {
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [slip, setSlip] = useState<Prepared | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: Blob) {
    setReading(true);
    setErr("");
    try {
      const p = await prepareSlip(f);
      setSlip(p);
      if (p.qr?.kind === "promptpay" && p.qr.amount && !amount) setAmount(String(p.qr.amount));
    } catch (e) {
      setErr("อ่านรูปไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setReading(false);
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }

  useEffect(() => {
    if (initialFile) handleFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cats = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const qr = slip?.qr;

  async function save() {
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.set("type", type);
    fd.set("amount", amount);
    fd.set("date", date);
    fd.set("category", category);
    fd.set("note", note || (qr?.kind === "promptpay" && qr.payee ? qr.payee : ""));
    if (qr?.kind === "slip") {
      fd.set("transRef", qr.transRef || "");
      fd.set("bank", qr.bank || "");
    }
    if (slip) fd.set("slip", slip.blob, "slip.jpg");
    try {
      const res = await fetch("/api/transactions", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      onSaved(data.item);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="เพิ่มรายการ">
        <div className="grab" />
        <div className="seg">
          <button className={`expense ${type === "expense" ? "on" : ""}`} onClick={() => { setType("expense"); setCategory(""); }}>
            รายจ่าย
          </button>
          <button className={`income ${type === "income" ? "on" : ""}`} onClick={() => { setType("income"); setCategory(""); }}>
            รายรับ
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {slip || reading ? (
          <div className="slip-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {slip ? <img src={slip.previewUrl} alt="สลิป" /> : <img alt="" />}
            <div className="meta">
              {reading ? (
                "กำลังอ่าน QR…"
              ) : qr?.kind === "slip" ? (
                <>
                  <div className="ok">✓ อ่าน QR สลิปได้</div>
                  <small>{qr.bank} · Ref {qr.transRef}</small>
                </>
              ) : qr?.kind === "promptpay" ? (
                <>
                  <div className="ok">✓ QR พร้อมเพย์</div>
                  <small>{qr.payee || ""}{qr.amount ? ` · ${qr.amount} บาท` : ""}</small>
                </>
              ) : (
                <>
                  <div className="warn">ไม่พบ QR ในรูป</div>
                  <small>ยังบันทึกรูปเป็นสลิปได้ตามปกติ</small>
                </>
              )}
            </div>
            <button className="icon-btn" onClick={() => fileRef.current?.click()}>เปลี่ยน</button>
          </div>
        ) : (
          <button className="btn ghost" style={{ marginTop: 0 }} onClick={() => fileRef.current?.click()}>
            📎 แนบสลิป / รูป QR
          </button>
        )}

        <label className="f">จำนวนเงิน {qr?.kind === "slip" && "(ดูจากสลิป)"}</label>
        <div className="amount-input">
          <input
            ref={amountRef}
            className="num"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          />
          <span>บาท</span>
        </div>

        <label className="f">หมวด</label>
        <div className="chips">
          {cats.map((c) => (
            <button key={c} className={`chip ${category === c ? "on" : ""}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        <label className="f">วันที่</label>
        <input className="in" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <label className="f">หมายเหตุ</label>
        <input className="in" placeholder="เช่น ค่าข้าวกลางวัน" value={note} onChange={(e) => setNote(e.target.value)} />

        <button className="btn" disabled={busy || reading || !(Number(amount) > 0)} onClick={save}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        {err && <div className="err">{err}</div>}
      </div>
    </>
  );
}
