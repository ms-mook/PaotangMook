import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";

export async function POST(req: Request) {
  const { pin } = await req.json().catch(() => ({ pin: "" }));
  const expected = process.env.APP_PIN;
  // small fixed delay slows down guessing
  await new Promise((r) => setTimeout(r, 400));
  if (!expected || String(pin) !== expected) {
    return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
