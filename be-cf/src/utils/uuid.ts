import { randomBytes } from "node:crypto";

export function generateUUID(): string {
  if (typeof crypto === "undefined") {
    return randomBytes(16).toString("hex");
  }

  return crypto.randomUUID();
}
