"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DetailSheet from "@/components/DetailSheet";
import ListView from "@/components/ListView";
import SettingsView from "@/components/SettingsView";
import StatsView from "@/components/StatsView";
import TxForm from "@/components/TxForm";
import { baht, daysLeft, monthLabel, shiftMonth, todayISO } from "@/lib/format";
import { DEFAULT_SETTINGS, type Settings, type Tx } from "@/lib/types";

type Tab = "list" | "stats" | "settings";
type Sheet =
  | { kind: "add"; queue: Blob[]; index: number }
  | { kind: "edit"; tx: Tx }
  | { kind: "detail"; tx: Tx }
  | null;
interface BIPEvent extends Event { prompt: () => Promise<void> }

const sortTx = (a: Tx, b: Tx) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt);

export default function Home() {
  const [items, setItems] = useState<Tx[] | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("list");
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState("");
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [iosTip, setIosTip] = useState(false);
  const slipInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (res.status === 401) return location.replace("/login");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items);
      setSettings(data.settings);
      setScanEnabled(!!data.scanEnabled);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
    if (new URLSearchParams(location.search).get("shared")) {
      history.replaceState(null, "", "/");
      caches.open("pt-share").then(async (c) => {
        const keys = await c.keys();
        const blobs: Blob[] = [];
        for (const k of keys) {
          const r = await c.match(k);
          if (r) blobs.push(await r.blob());
          await c.delete(k);
        }
        if (blobs.length) setSheet({ kind: "add", queue: blobs, index: 0 });
      });
    }
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (!standalone && /iphone|ipad/i.test(navigator.userAgent)) setIosTip(true);
    const onBip = (e: Event) => { e.preventDefault(); setInstallEvt(e as BIPEvent); };
    addEventListener("beforeinstallprompt", onBip);
    return () => removeEventListener("beforeinstallprompt", onBip);
  }, [load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const all = useMemo(() => items || [], [items]);
  const monthItems = useMemo(() => all.filter((t) => t.date.startsWith(month)), [all, month]);
  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of monthItems) t.type === "income" ? (inc += t.amount) : (exp += t.amount);
    return { inc, exp, net: inc - exp };
  }, [monthItems]);

  const budgetAlerts = useMemo(() => {
    const spent: Record<string, number> = {};
    for (const t of monthItems) if (t.type === "expense") spent[t.category] = (spent[t.category] || 0) + t.amount;
    return Object.entries(settings.budgets)
      .filter(([c, limit]) => limit > 0 && (spent[c] || 0) >= limit * 0.8)
      .map(([c, limit]) => ({ c, pct: Math.round(((spent[c] || 0) / limit) * 100) }));
  }, [monthItems, settings.budgets]);

  const limit = useMemo(() => {
    const cap = settings.monthlyLimit;
    if (!(cap > 0)) return null;
    const left = cap - totals.exp;
    const pct = Math.round((totals.exp / cap) * 100);
    const d = daysLeft(month);
    return {
      left,
      pct,
      level: pct >= 100 ? "over" : pct >= 80 ? "near" : "ok",
      perDay: d && left > 0 ? Math.floor(left / d) : null,
    };
  }, [settings.monthlyLimit, totals.exp, month]);

  function nextInQueue() {
    setSheet((s) => (s?.kind === "add" && s.index + 1 < s.queue.length ? { ...s, index: s.index + 1 } : null));
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    location.replace("/login");
  }

  const needsSetup = /ยังไม่ได้ตั้งค่า|เวอร์ชันเก่า|SECRET/.test(error);

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

      {tab !== "settings" && (
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
          {limit && (
            <button className="limit" onClick={() => setTab("stats")}>
              <div className="limit-top">
                <span>วงเงินเดือนนี้</span>
                <span className="num">{baht(totals.exp)} / {baht(settings.monthlyLimit)}</span>
              </div>
              <div className="meter"><div className={limit.level} style={{ width: `${Math.min(limit.pct, 100)}%` }} /></div>
              <small>
                {limit.left < 0
                  ? `เกินวงเงิน ${baht(-limit.left)} บาท`
                  : `เหลือ ${baht(limit.left)} บาท` + (limit.perDay !== null ? ` · ใช้ได้อีกวันละ ~${baht(limit.perDay)} บาท` : "")}
              </small>
            </button>
          )}
        </section>
      )}

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

      {tab === "list" && limit && limit.pct >= 80 && (
        <button className={`alert ${limit.level}`} onClick={() => setTab("stats")}>
          {limit.pct >= 100 ? "🚨 ใช้เกินวงเงินเดือนนี้แล้ว" : `⚠️ ใช้ไป ${limit.pct}% ของวงเงินเดือนนี้`}
        </button>
      )}
      {tab === "list" && budgetAlerts.length > 0 && (
        <button className="alert" onClick={() => setTab("stats")}>
          ⚠️ {budgetAlerts.map((a) => `${a.c} ${a.pct}%`).join(" · ")} ของงบเดือนนี้
        </button>
      )}

      {needsSetup ? (
        <div className="empty">
          {error}<br />
          <a href="/setup">ไปหน้าตรวจสถานะ →</a>
        </div>
      ) : error ? (
        <div className="empty err">{error}<br /><button className="chip" onClick={load}>ลองใหม่</button></div>
      ) : items === null ? (
        <div className="empty">กำลังโหลด…</div>
      ) : tab === "list" ? (
        <ListView items={monthItems} allItems={all} settings={settings} onOpen={(tx) => setSheet({ kind: "detail", tx })} />
      ) : tab === "stats" ? (
        <StatsView allItems={all} month={month} settings={settings} />
      ) : (
        <SettingsView settings={settings} scanEnabled={scanEnabled} onSaved={(s) => { setSettings(s); flash("บันทึกแล้ว ✓"); }} />
      )}

      {tab === "list" && (
        <div className="fab-bar">
          <input
            ref={slipInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files || [])];
              e.target.value = "";
              if (files.length) setSheet({ kind: "add", queue: files, index: 0 });
            }}
          />
          <button className="fab slip" onClick={() => slipInput.current?.click()}>📎 สลิป</button>
          <button className="fab add" onClick={() => setSheet({ kind: "add", queue: [], index: 0 })}>＋ จดรายการ</button>
        </div>
      )}

      <nav className="tabbar">
        {([["list", "🧾", "รายการ"], ["stats", "📊", "สรุป"], ["settings", "⚙️", "ตั้งค่า"]] as const).map(([k, icon, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {sheet?.kind === "add" && (
        <TxForm
          key={`add-${sheet.index}`}
          settings={settings}
          scanEnabled={scanEnabled}
          file={sheet.queue[sheet.index] || null}
          queue={{ index: sheet.index, total: sheet.queue.length }}
          onClose={() => setSheet(null)}
          onSkip={nextInQueue}
          onSaved={(tx) => {
            setItems((cur) => [tx, ...(cur || [])].sort(sortTx));
            if (sheet.queue.length <= 1) setMonth(tx.date.slice(0, 7));
            flash(sheet.index + 1 < sheet.queue.length ? `บันทึกแล้ว ✓ (${sheet.index + 1}/${sheet.queue.length})` : "บันทึกแล้ว ✓");
            nextInQueue();
          }}
        />
      )}
      {sheet?.kind === "edit" && (
        <TxForm
          key={`edit-${sheet.tx.id}`}
          settings={settings}
          scanEnabled={scanEnabled}
          editing={sheet.tx}
          onClose={() => setSheet(null)}
          onSaved={(tx) => {
            setItems((cur) => (cur || []).map((t) => (t.id === tx.id ? tx : t)).sort(sortTx));
            setSheet({ kind: "detail", tx });
            flash("แก้ไขแล้ว ✓");
          }}
        />
      )}
      {sheet?.kind === "detail" && (
        <DetailSheet
          tx={sheet.tx}
          onClose={() => setSheet(null)}
          onEdit={(tx) => setSheet({ kind: "edit", tx })}
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
