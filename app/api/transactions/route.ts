import { NextResponse } from "next/server";
import { appendTx, listTx, uploadSlip, type Tx } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listTx();
    items.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const type = form.get("type") === "income" ? "income" : "expense";
    const amount = Number(String(form.get("amount") || "").replace(/,/g, ""));
    const date = String(form.get("date") || "");
    if (!(amount > 0)) return NextResponse.json({ error: "กรุณาใส่จำนวนเงิน" }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });

    const transRef = String(form.get("transRef") || "").trim();
    if (transRef) {
      const existing = (await listTx()).find((t) => t.transRef === transRef);
      if (existing) {
        return NextResponse.json(
          { error: `สลิปนี้บันทึกไปแล้ว (${existing.date}, ${existing.amount.toLocaleString("th-TH")} บาท)` },
          { status: 409 },
        );
      }
    }

    const id = crypto.randomUUID();
    let slipFileId = "";
    const slip = form.get("slip");
    if (slip instanceof File && slip.size > 0) {
      const ext = slip.type === "image/png" ? "png" : "jpg";
      const name = `${date}_${type === "income" ? "รับ" : "จ่าย"}_${amount}_${transRef || id.slice(0, 8)}.${ext}`;
      slipFileId = await uploadSlip(name, slip.type || "image/jpeg", await slip.arrayBuffer());
    }

    const tx: Tx = {
      id,
      createdAt: new Date().toISOString(),
      date,
      type,
      amount,
      category: String(form.get("category") || "").slice(0, 50),
      note: String(form.get("note") || "").slice(0, 300),
      bank: String(form.get("bank") || "").slice(0, 50),
      transRef,
      slipFileId,
    };
    await appendTx(tx);
    return NextResponse.json({ item: tx });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
