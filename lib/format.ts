export const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export function todayISO() {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_FULL[m - 1]} ${y + 543}`;
}

export function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const today = todayISO();
  const yd = new Date();
  yd.setDate(yd.getDate() - 1);
  const p = (x: number) => String(x).padStart(2, "0");
  const yesterday = `${yd.getFullYear()}-${p(yd.getMonth() + 1)}-${p(yd.getDate())}`;
  if (iso === today) return "วันนี้";
  if (iso === yesterday) return "เมื่อวาน";
  return `${d} ${MONTHS[m - 1]} ${String(y + 543).slice(2)}`;
}

/** Days left in the month including today; null if ym is not the current month. */
export function daysLeft(ym: string) {
  const today = todayISO();
  if (!today.startsWith(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return last - Number(today.slice(8, 10)) + 1;
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
