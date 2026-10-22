import { NextResponse } from "next/server";
import { deleteTx, StoreError } from "@/lib/store";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await deleteTx(id); // slip goes to Drive trash (recoverable for 30 days)
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof StoreError ? e.status : 500 });
  }
}
