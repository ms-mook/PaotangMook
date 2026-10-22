import { NextResponse } from "next/server";
import type { ScanResult } from "@/lib/types";

export const maxDuration = 30;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    isSlip: { type: "BOOLEAN", description: "true if the image is a Thai bank transfer / payment slip or e-receipt" },
    amount: { type: "NUMBER", description: "transfer amount in THB, without fee" },
    date: { type: "STRING", description: "transaction date as YYYY-MM-DD in the Gregorian calendar (convert Buddhist year: subtract 543)" },
    time: { type: "STRING", description: "HH:MM if visible" },
    fromName: { type: "STRING" },
    fromBank: { type: "STRING", description: "sender bank in Thai, e.g. กสิกรไทย, ไทยพาณิชย์, กรุงเทพ, กรุงไทย, กรุงศรี, ทีทีบี, ออมสิน" },
    toName: { type: "STRING", description: "receiver / shop name" },
    toBank: { type: "STRING" },
    transRef: { type: "STRING", description: "transaction reference number" },
    memo: { type: "STRING", description: "memo / note written on the slip, if any" },
    suggestedCategory: { type: "STRING", description: "best matching category from the given list" },
  },
  required: ["isSlip"],
};

function fixDate(d?: string) {
  const m = d?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  let y = Number(m[1]);
  if (y > 2400) y -= 543; // Buddhist year slipped through
  return `${y}-${m[2]}-${m[3]}`;
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY" }, { status: 501 });
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "no image" }, { status: 400 });
    const categories = String(form.get("categories") || "");
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");

    const res = await fetch(
      `${process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mime_type: file.type || "image/jpeg", data } },
                {
                  text:
                    "Read this Thai bank transfer slip and extract the fields. " +
                    "Thai months: ม.ค.=01 ก.พ.=02 มี.ค.=03 เม.ย.=04 พ.ค.=05 มิ.ย.=06 ก.ค.=07 ส.ค.=08 ก.ย.=09 ต.ค.=10 พ.ย.=11 ธ.ค.=12. " +
                    "A 2-digit year like 69 means Buddhist 2569 = 2026. Leave fields empty if unreadable; never guess the amount. " +
                    `Categories to choose from: ${categories}`,
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
        }),
      },
    );
    const body = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: `Gemini: ${body?.error?.message || res.status}` }, { status: 502 });
    }
    const text: string = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "{}";
    const r = JSON.parse(text) as ScanResult;
    const out: ScanResult = {
      ...r,
      amount: r.amount && r.amount > 0 ? Math.round(r.amount * 100) / 100 : undefined,
      date: fixDate(r.date),
    };
    return NextResponse.json({ result: out });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
