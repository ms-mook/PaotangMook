"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddSheet from "@/components/AddSheet";
import DetailSheet from "@/components/DetailSheet";
import { baht, dayLabel, monthLabel, shiftMonth, todayISO } from "@/lib/format";
import type { Tx } from "@/lib/google";

const ICONS: Record<string, string> = {
  อาหาร: "🍜", เดินทาง: "🚕", ช้อปปิ้ง: "🛍️", "บิล/ค่าน้ำไฟ": "💡", ที่พัก: "🏠", สุขภาพ: "💊",
  บันเทิง: "🎬", โอนให้คนอื่น: "↗️", เงินเดือน: "💼", โบนัส: "🎉", ขายของ: "🏷️", รับโอน: "↙️",
  "ดอกเบี้ย/ปันผล": "📈",
};

type Sheet = { kind: "add"; file?: Blob | null } | { kind: "detail"; tx: Tx } | null;
interface BIPEvent extends Event { prompt: () => Promise<void> }

export default function Home() {
  const [items, setItems] = useState<Tx[] | null>(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState("");
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [iosTip, setIosTip] = useState(false);
  const slipInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions", { cache: "no-store" });
      if (res.status === 401) return location.replace("/login");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
    // slip shared from another app (Android share target)
    if (new URLSearchParams(location.search).get("shared")) {
      history.replaceState(null, "", "/");
      caches.open("pt-share").then(async (c) => {
        const r = await c.match("/shared-slip");
        if (r) {
          setSheet({ kind: "add", file: await r.blob() });
          c.delete("/shared-slip");
        }
      });
    }
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (!standalone && /iphone|ipad/i.test(navigator.userAgent)) setIosTip(true);
    const onBip = (e: Event) => { e.preventDefault(); setInstallEvt(e as BIPEvent); };
    addEventListener("beforeinstallprompt", onBip);
    return () => removeEventListener("beforeinstallprompt", onBip);
  }, [load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const monthItems = useMemo(() => (items || []).filter((t) => t.date.startsWith(month)), [items, month]);
  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of monthItems) t.type === "income" ? (inc += t.amount) : (exp += t.amount);
    return { inc, exp, net: inc - exp };
  }, [monthItems]);
  const groups = useMemo(() => {
    const m = new Map<string, Tx[]>();
    for (const t of monthItems) m.set(t.date, [...(m.get(t.date) || []), t]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthItems]);

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    location.replace("/login");
  }

  const needsSetup = /ยังไม่ได้ตั้งค่า/.test(error);

  return (
    <main className="wrap">
      <header className="top">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" />
          เป๋าตังค์
        </div>
        <button className="icon-btn" onClick={logout}>ออกจากระบบ</button>
      </header>

      <section className="card-balance">
        <div className="month-nav">
          <button aria-label="เดือนก่อน" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <span>{monthLabel(month)}</span>
          <button aria-label="เดือนถัดไป" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>
        <div className="balance-label">คงเหลือเดือนนี้</div>
        <div className="balance num">{totals.net < 0 ? "−" : ""}{baht(Math.abs(totals.net))} ฿</div>
        <div className="split">
          <div><small>รายรับ</small><b className="num">{baht(totals.inc)}</b></div>
          <div><small>รายจ่าย</small><b className="num">{baht(totals.exp)}</b></div>
        </div>
      </section>

      {installEvt && (
        <div className="install-tip">
          📲 ติดตั้งเป๋าตังค์ไว้บนหน้าจอ
          <button className="chip on" onClick={() => { installEvt.prompt(); setInstallEvt(null); }}>ติดตั้ง</button>
        </div>
      )}
      {iosTip && (
        <div className="install-tip">
          📲 กดปุ่ม แชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม” เพื่อติดตั้งแอป
          <button className="icon-btn" onClick={() => setIosTip(false)}>✕</button>
        </div>
      )}

      {needsSetup ? (
        <div className="empty">
          ยังไม่ได้เชื่อม Google Drive/Sheets<br />
          <a href="/setup">ไปหน้าตั้งค่า →</a>
        </div>
      ) : error ? (
        <div className="empty err">{error}</div>
      ) : items === null ? (
        <div className="empty">กำลังโหลด…</div>
      ) : groups.length === 0 ? (
        <div className="empty">ยังไม่มีรายการในเดือนนี้<br />กด “สลิป” เพื่อโยนสลิปเข้ามาได้เลย</div>
      ) : (
        groups.map(([date, list]) => {
          const dayNet = list.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
          return (
            <section className="day" key={date}>
              <h3><span>{dayLabel(date)}</span><span className="num">{dayNet >= 0 ? "+" : "−"}{baht(Math.abs(dayNet))}</span></h3>
              <div className="list">
                {list.map((t) => (
                  <button className="row" key={t.id} onClick={() => setSheet({ kind: "detail", tx: t })}>
                    <span className="dot">{ICONS[t.category] || (t.type === "income" ? "💰" : "💸")}</span>
                    <span className="mid">
                      <b>{t.note || t.category || (t.type === "income" ? "รายรับ" : "รายจ่าย")}</b>
                      <small>{[t.category, t.bank, t.slipFileId ? "📎 สลิป" : ""].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className={`amt num ${t.type}`}>{t.type === "income" ? "+" : "−"}{baht(t.amount)}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })
      )}

      <div className="fab-bar">
        <input
          ref={slipInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setSheet({ kind: "add", file: f });
          }}
        />
        <button className="fab slip" onClick={() => slipInput.current?.click()}>📎 สลิป</button>
        <button className="fab add" onClick={() => setSheet({ kind: "add" })}>＋ จดรายการ</button>
      </div>

      {sheet?.kind === "add" && (
        <AddSheet
          initialFile={sheet.file}
          onClose={() => setSheet(null)}
          onSaved={(tx) => {
            setItems((cur) => [tx, ...(cur || [])]);
            setMonth(tx.date.slice(0, 7));
            setSheet(null);
            flash("บันทึกแล้ว ✓");
          }}
        />
      )}
      {sheet?.kind === "detail" && (
        <DetailSheet
          tx={sheet.tx}
          onClose={() => setSheet(null)}
          onDeleted={(id) => {
            setItems((cur) => (cur || []).filter((t) => t.id !== id));
            setSheet(null);
            flash("ลบแล้ว");
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
