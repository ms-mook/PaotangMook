import { downloadSlip } from "@/lib/google";

// Streams a slip image from Drive so it can be shown in the app without a Google login.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const res = await downloadSlip(id);
    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
