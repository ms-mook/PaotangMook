import { NextResponse } from "next/server";
import { addTx, listTx, StoreError } from "@/lib/store";
import type { Tx } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const fail = (e: unknown) =>
  NextResponse.json({ error: (e as Error).message }, { status: e instanceof StoreError ? e.status : 500 });

export async function GET() {
  try {
    const items = await listTx();
    items.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    return NextResponse.json({ items });
  } catch (e) {
    return fail(e);
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

    const id = crypto.randomUUID();
    const transRef = String(form.get("transRef") || "").trim().slice(0, 64);
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
      slipFileId: "",
    };

    const file = form.get("slip");
    let slip;
    if (file instanceof File && file.size > 0) {
      const ext = file.type === "image/png" ? "png" : "jpg";
      slip = {
        name: `${date}_${type === "income" ? "รับ" : "จ่าย"}_${amount}_${transRef || id.slice(0, 8)}.${ext}`,
        mime: file.type || "image/jpeg",
        bytes: await file.arrayBuffer(),
      };
    }

    return NextResponse.json({ item: await addTx(tx, slip) });
  } catch (e) {
    return fail(e);
  }
}
