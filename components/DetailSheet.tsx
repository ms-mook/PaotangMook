"use client";
import { useState } from "react";
import { baht, dayLabel } from "@/lib/format";
import type { Tx } from "@/lib/types";

interface Props {
  tx: Tx;
  onClose: () => void;
  onEdit: (tx: Tx) => void;
  onDeleted: (id: string) => void;
}

export default function DetailSheet({ tx, onClose, onEdit, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function remove() {
    if (!confirm("ลบรายการนี้? (สลิปจะย้ายไปถังขยะใน Google Drive)")) return;
    setBusy(true);
    const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(tx.id);
    else {
      setErr((await res.json().catch(() => ({}))).error || "ลบไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="grab" />
        <div className={`amt num ${tx.type}`} style={{ fontSize: 30 }}>
          {tx.type === "income" ? "+" : "−"}
          {baht(tx.amount)} บาท
        </div>
        <dl className="kv">
          <dt>ประเภท</dt>
          <dd>{tx.type === "income" ? "รายรับ" : "รายจ่าย"}</dd>
          <dt>หมวด</dt>
          <dd>{tx.category || "-"}</dd>
          {tx.account && (<><dt>บัญชี</dt><dd>{tx.account}</dd></>)}
          <dt>วันที่</dt>
          <dd>{dayLabel(tx.date)}</dd>
          {tx.note && (<><dt>หมายเหตุ</dt><dd>{tx.note}</dd></>)}
          {tx.bank && (<><dt>ธนาคารผู้โอน</dt><dd>{tx.bank}</dd></>)}
          {tx.transRef && (<><dt>เลขอ้างอิง</dt><dd className="num">{tx.transRef}</dd></>)}
        </dl>
        {tx.slipFileId && (
          <a href={`/api/slip/${tx.slipFileId}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="detail-img" src={`/api/slip/${tx.slipFileId}`} alt="สลิป" loading="lazy" />
          </a>
        )}
        <div className="btn-row">
          <button className="btn ghost" disabled={busy} onClick={() => onEdit(tx)}>✏️ แก้ไข</button>
          <button className="btn danger" disabled={busy} onClick={remove}>{busy ? "กำลังลบ…" : "ลบ"}</button>
        </div>
        {err && <div className="err">{err}</div>}
      </div>
    </>
  );
}
