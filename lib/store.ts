// Server-only client for the Apps Script web app that owns the Google Sheet + slip folder.
import type { Tx } from "./types";

export class StoreError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new StoreError("ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL / APPS_SCRIPT_SECRET");

  // Apps Script answers POST with a 302 to a googleusercontent URL; fetch follows it as GET.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret, action, ...payload }),
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  let data: { error?: string; duplicate?: boolean } & Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new StoreError(
      res.ok
        ? "Apps Script ตอบกลับไม่ใช่ JSON — ตรวจว่า Deploy เป็นเว็บแอป และตั้ง 'ผู้มีสิทธิ์เข้าถึง: ทุกคน'"
        : `Apps Script error ${res.status}`,
    );
  }
  if (data.error === "unauthorized") throw new StoreError("APPS_SCRIPT_SECRET ไม่ตรงกับ SECRET ในสคริปต์", 500);
  if (data.error) throw new StoreError(data.error, data.duplicate ? 409 : 400);
  return data as T;
}

export const ping = () => call<{ ok: boolean; sheet: string; folder: string }>("ping");

export async function listTx(): Promise<Tx[]> {
  return (await call<{ items: Tx[] }>("list")).items;
}

export async function addTx(tx: Tx, slip?: { name: string; mime: string; bytes: ArrayBuffer }): Promise<Tx> {
  const res = await call<{ item: Tx }>("add", {
    tx,
    slip: slip ? { name: slip.name, mime: slip.mime, data: Buffer.from(slip.bytes).toString("base64") } : null,
  });
  return res.item;
}

export async function deleteTx(id: string) {
  await call("delete", { id });
}

export async function getSlip(id: string): Promise<{ mime: string; bytes: Buffer }> {
  const res = await call<{ mime: string; data: string }>("slip", { id });
  return { mime: res.mime, bytes: Buffer.from(res.data, "base64") };
}
