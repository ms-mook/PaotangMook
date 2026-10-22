import { NextResponse } from "next/server";
import { deleteTx, trashSlip } from "@/lib/google";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const tx = await deleteTx(id);
    if (!tx) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
    // slip goes to Drive trash (recoverable for 30 days)
    if (tx.slipFileId) await trashSlip(tx.slipFileId).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
