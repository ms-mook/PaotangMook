import { NextResponse } from "next/server";
import { SCOPE } from "@/lib/google";

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return new Response("ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID ใน Vercel", { status: 500 });
  const origin = new URL(req.url).origin;
  const state = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/google/callback`,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("pt_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
