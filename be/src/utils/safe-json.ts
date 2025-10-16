import type { Ctx } from "@/types/types";

export default async function safeJson<T = unknown>(c: Ctx): Promise<T | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
