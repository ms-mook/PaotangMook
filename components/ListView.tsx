"use client";
import { useMemo, useState } from "react";
import { baht, dayLabel } from "@/lib/format";
import { iconFor } from "@/lib/icons";
import type { Settings, Tx } from "@/lib/types";

interface Props {
  items: Tx[]; // already scoped to the month
  allItems: Tx[];
  settings: Settings;
  onOpen: (tx: Tx) => void;
}

type TypeFilter = "all" | "income" | "expense";

export default function ListView({ items, allItems, settings, onOpen }: Props) {
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<TypeFilter>("all");
  const [cat, setCat] = useState("");
  const [acc, setAcc] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const searching = q.trim().length > 0;
  const active = searching || typeF !== "all" || !!cat || !!acc;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (searching ? allItems : items).filter((t) => {
      if (typeF !== "all" && t.type !== typeF) return false;
      if (cat && t.category !== cat) return false;
      if (acc && t.account !== acc) return false;
      if (needle) {
        const hay = `${t.note} ${t.category} ${t.account} ${t.bank} ${t.transRef} ${t.amount}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, allItems, q, typeF, cat, acc, searching]);

  const groups = useMemo(() => {
    const m = new Map<string, Tx[]>();
    for (const t of filtered) m.set(t.date, [...(m.get(t.date) || []), t]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const total = filtered.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const allCats = [...new Set([...settings.expenseCategories, ...settings.incomeCategories])];

  return (
    <>
      <div className="search">
        <input
          className="in"
          type="search"
          placeholder="🔍 ค้นหาทุกเดือน"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className={`chip ${showFilters || active ? "on" : ""}`} onClick={() => setShowFilters(!showFilters)}>
          ตัวกรอง{active && !searching ? " •" : ""}
        </button>
      </div>

      {showFilters && (
        <div className="filters">
          <div className="chips">
            {(["all", "expense", "income"] as const).map((t) => (
              <button key={t} className={`chip ${typeF === t ? "on" : ""}`} onClick={() => setTypeF(t)}>
                {t === "all" ? "ทั้งหมด" : t === "income" ? "รายรับ" : "รายจ่าย"}
              </button>
            ))}
          </div>
          <div className="filter-row">
            <select className="in" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">ทุกหมวด</option>
              {allCats.map((c) => <option key={c}>{c}</option>)}
            </select>
            {settings.accounts.length > 0 && (
              <select className="in" value={acc} onChange={(e) => setAcc(e.target.value)}>
                <option value="">ทุกบัญชี</option>
                {settings.accounts.map((a) => <option key={a}>{a}</option>)}
              </select>
            )}
          </div>
          {active && (
            <button className="icon-btn" onClick={() => { setQ(""); setTypeF("all"); setCat(""); setAcc(""); }}>
              ล้างตัวกรอง
            </button>
          )}
        </div>
      )}

      {active && (
        <div className="result-bar">
          พบ {filtered.length} รายการ{searching ? " (ทุกเดือน)" : ""} · รวม{" "}
          <b className={`num ${total >= 0 ? "income" : "expense"}`}>{total >= 0 ? "+" : "−"}{baht(Math.abs(total))}</b>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty">
          {active ? "ไม่พบรายการที่ตรงกัน" : <>ยังไม่มีรายการในเดือนนี้<br />กด “สลิป” เพื่อโยนสลิปเข้ามาได้เลย</>}
        </div>
      ) : (
        groups.map(([date, list]) => {
          const dayNet = list.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
          return (
            <section className="day" key={date}>
              <h3>
                <span>{dayLabel(date)}</span>
                <span className="num">{dayNet >= 0 ? "+" : "−"}{baht(Math.abs(dayNet))}</span>
              </h3>
              <div className="list">
                {list.map((t) => (
                  <button className="row" key={t.id} onClick={() => onOpen(t)}>
                    <span className="dot">{iconFor(t.category, t.type)}</span>
                    <span className="mid">
                      <b>{t.note || t.category || (t.type === "income" ? "รายรับ" : "รายจ่าย")}</b>
                      <small>{[t.category, t.account, t.slipFileId ? "📎" : ""].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className={`amt num ${t.type}`}>{t.type === "income" ? "+" : "−"}{baht(t.amount)}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
