"use client";
import { useEffect, useRef, useState } from "react";
import { prepareSlip, type Prepared } from "@/lib/image";
import { todayISO } from "@/lib/format";
import type { ScanResult, Settings, Tx, TxType } from "@/lib/types";

interface Props {
  settings: Settings;
  scanEnabled: boolean;
  editing?: Tx;
  file?: Blob | null;
  queue?: { index: number; total: number };
  onClose: () => void;
  onSkip?: () => void;
  onSaved: (tx: Tx, wasEdit: boolean) => void;
}

function matchAccount(accounts: string[], bank?: string) {
  if (!bank) return "";
  const b = bank.replace(/^ธนาคาร/, "").trim();
  return accounts.find((a) => a && (a.includes(b) || b.includes(a.replace(/^ธนาคาร/, "").trim()))) || "";
}

export default function TxForm({ settings, scanEnabled, editing, file, queue, onClose, onSkip, onSaved }: Props) {
  const [type, setType] = useState<TxType>(editing?.type || "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [category, setCategory] = useState(editing?.category || "");
  const [account, setAccount] = useState(editing ? editing.account : settings.accounts[0] || "");
  const [date, setDate] = useState(editing?.date || todayISO());
  const [note, setNote] = useState(editing?.note || "");
  const [bank, setBank] = useState(editing?.bank || "");
  const [transRef, setTransRef] = useState(editing?.transRef || "");
  const [slip, setSlip] = useState<Prepared | null>(null);
  const [reading, setReading] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanErr, setScanErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const touched = useRef<Set<string>>(new Set());
  const touch = (k: string) => touched.current.add(k);

  async function handleFile(f: Blob) {
    setErr("");
    setScan(null);
    setScanErr("");
    setReading("กำลังอ่าน QR…");
    let p: Prepared;
    try {
      p = await prepareSlip(f);
    } catch (e) {
      setErr("อ่านรูปไม่สำเร็จ: " + (e as Error).message);
      setReading("");
      return;
    }
    setSlip(p);
    const qr = p.qr;
    if (qr?.kind === "slip") {
      if (qr.transRef) setTransRef(qr.transRef);
      if (qr.bank) setBank(qr.bank);
      if (!touched.current.has("account")) {
        const acc = matchAccount(settings.accounts, qr.bank);
        if (acc) setAccount(acc);
      }
    }
    if (qr?.kind === "promptpay") {
      if (qr.amount && !touched.current.has("amount")) setAmount(String(qr.amount));
      if (qr.payee && !touched.current.has("note")) setNote(qr.payee);
    }

    if (scanEnabled) {
      setReading("AI กำลังอ่านยอดเงินจากสลิป…");
      try {
        const fd = new FormData();
        fd.set("image", p.blob, "slip.jpg");
        fd.set("categories", [...settings.expenseCategories, ...settings.incomeCategories].join(", "));
        const res = await fetch("/api/scan", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const r: ScanResult = data.result;
        setScan(r);
        if (r.isSlip !== false) {
          const t = touched.current;
          if (r.amount && !t.has("amount")) setAmount(String(r.amount));
          if (r.date && !t.has("date")) setDate(r.date);
          if (!t.has("note")) {
            const who = type === "income" ? r.fromName : r.toName;
            const n = [r.memo, who].filter(Boolean).join(" · ");
            if (n) setNote(n);
          }
          if (!t.has("category") && r.suggestedCategory) {
            const list = type === "income" ? settings.incomeCategories : settings.expenseCategories;
            if (list.includes(r.suggestedCategory)) setCategory(r.suggestedCategory);
          }
          if (r.transRef && !(qr?.kind === "slip")) setTransRef(r.transRef);
          if (r.fromBank && !(qr?.kind === "slip")) setBank(r.fromBank);
          if (!t.has("account")) {
            const acc = matchAccount(settings.accounts, r.fromBank || qr?.bank);
            if (acc) setAccount(acc);
          }
        }
      } catch (e) {
        setScanErr((e as Error).message);
      }
    }
    setReading("");
    setTimeout(() => amountRef.current?.focus(), 50);
  }

  useEffect(() => {
    if (file) handleFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cats = type === "expense" ? settings.expenseCategories : settings.incomeCategories;
  const qr = slip?.qr;

  async function save() {
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.set("type", type);
    fd.set("amount", amount);
    fd.set("date", date);
    fd.set("category", category);
    fd.set("note", note);
    fd.set("bank", bank);
    fd.set("transRef", transRef);
    fd.set("account", account);
    if (slip) fd.set("slip", slip.blob, "slip.jpg");
    try {
      const res = await fetch(editing ? `/api/transactions/${editing.id}` : "/api/transactions", {
        method: editing ? "PATCH" : "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      onSaved(data.item, !!editing);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const slipThumb = slip?.previewUrl || (editing?.slipFileId ? `/api/slip/${editing.slipFileId}` : "");

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={editing ? "แก้ไขรายการ" : "เพิ่มรายการ"}>
        <div className="grab" />
        <div className="sheet-head">
          <b>{editing ? "แก้ไขรายการ" : "เพิ่มรายการ"}</b>
          {queue && queue.total > 1 && (
            <span className="badge">
              สลิป {queue.index + 1}/{queue.total}
            </span>
          )}
        </div>
        <div className="seg">
          <button className={`expense ${type === "expense" ? "on" : ""}`} onClick={() => { setType("expense"); if (!settings.expenseCategories.includes(category)) setCategory(""); }}>
            รายจ่าย
          </button>
          <button className={`income ${type === "income" ? "on" : ""}`} onClick={() => { setType("income"); if (!settings.incomeCategories.includes(category)) setCategory(""); }}>
            รายรับ
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) handleFile(f);
          }}
        />
        {slipThumb || reading ? (
          <div className="slip-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {slipThumb ? <img src={slipThumb} alt="สลิป" /> : <img alt="" />}
            <div className="meta">
              {reading ? (
                <span className="pulse">{reading}</span>
              ) : !slip ? (
                <small>สลิปเดิม — กด “เปลี่ยน” เพื่อแนบใหม่</small>
              ) : (
                <>
                  {qr?.kind === "slip" ? (
                    <div className="ok">✓ QR สลิป · {qr.bank}</div>
                  ) : qr?.kind === "promptpay" ? (
                    <div className="ok">✓ QR พร้อมเพย์</div>
                  ) : (
                    <div className="muted">ไม่พบ QR ในรูป</div>
                  )}
                  {scan && scan.isSlip !== false && scan.amount ? (
                    <div className="ok">✓ AI อ่านยอด {scan.amount.toLocaleString("th-TH")} บาท — ตรวจอีกครั้ง</div>
                  ) : scan && scan.isSlip === false ? (
                    <small>AI: รูปนี้ไม่น่าใช่สลิป</small>
                  ) : scanErr ? (
                    <small className="warn">AI อ่านไม่สำเร็จ: {scanErr}</small>
                  ) : null}
                  {transRef && <small>Ref {transRef}</small>}
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

        <label className="f">จำนวนเงิน</label>
        <div className="amount-input">
          <input
            ref={amountRef}
            className="num"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => { touch("amount"); setAmount(e.target.value.replace(/[^\d.]/g, "")); }}
          />
          <span>บาท</span>
        </div>

        <label className="f">หมวด</label>
        <div className="chips">
          {cats.map((c) => (
            <button key={c} className={`chip ${category === c ? "on" : ""}`} onClick={() => { touch("category"); setCategory(category === c ? "" : c); }}>
              {c}
            </button>
          ))}
        </div>

        {settings.accounts.length > 0 && (
          <>
            <label className="f">บัญชี / กระเป๋า</label>
            <div className="chips">
              {settings.accounts.map((a) => (
                <button key={a} className={`chip ${account === a ? "on" : ""}`} onClick={() => { touch("account"); setAccount(account === a ? "" : a); }}>
                  {a}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="f">วันที่</label>
        <input className="in" type="date" value={date} onChange={(e) => { touch("date"); setDate(e.target.value); }} />

        <label className="f">หมายเหตุ</label>
        <input className="in" placeholder="เช่น ค่าข้าวกลางวัน" value={note} onChange={(e) => { touch("note"); setNote(e.target.value); }} />

        <button className="btn" disabled={busy || !!reading || !(Number(amount) > 0)} onClick={save}>
          {busy ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : queue && queue.index + 1 < queue.total ? "บันทึก แล้วไปใบถัดไป" : "บันทึก"}
        </button>
        {onSkip && queue && queue.total > 1 && (
          <button className="btn ghost" disabled={busy} onClick={onSkip}>
            ข้ามสลิปนี้
          </button>
        )}
        {err && <div className="err">{err}</div>}
      </div>
    </>
  );
}
