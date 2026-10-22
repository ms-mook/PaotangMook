const ICONS: Record<string, string> = {
  อาหาร: "🍜", เดินทาง: "🚕", ช้อปปิ้ง: "🛍️", "บิล/ค่าน้ำไฟ": "💡", ที่พัก: "🏠", สุขภาพ: "💊",
  บันเทิง: "🎬", โอนให้คนอื่น: "↗️", เงินเดือน: "💼", โบนัส: "🎉", ขายของ: "🏷️", รับโอน: "↙️",
  "ดอกเบี้ย/ปันผล": "📈", กาแฟ: "☕", ของใช้: "🧴", ลูก: "🧸", สัตว์เลี้ยง: "🐾", ประกัน: "🛡️",
  ลงทุน: "📊", ท่องเที่ยว: "✈️", การศึกษา: "📚", ของขวัญ: "🎁", น้ำมัน: "⛽", ผ่อน: "💳",
};

const EMOJI_START = /^\p{Extended_Pictographic}/u;

export function iconFor(category: string, type: "income" | "expense") {
  if (ICONS[category]) return ICONS[category];
  const m = category.match(EMOJI_START);
  if (m) return m[0];
  return type === "income" ? "💰" : "💸";
}

// categorical palette that reads in both light and dark themes
export const PALETTE = ["#0d7a5c", "#e0a030", "#c2553b", "#4a7fc1", "#8a5cb8", "#3fa3a0", "#d0749a", "#7d8b3a", "#9a7b5c", "#6b7570"];
