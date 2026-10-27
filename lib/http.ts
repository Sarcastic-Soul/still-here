import { NextResponse } from "next/server";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function body<T>(req: Request): Promise<Partial<T>> {
  return (await req.json().catch(() => ({}))) as Partial<T>;
}
