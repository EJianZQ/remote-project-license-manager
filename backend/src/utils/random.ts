import { randomBytes } from "node:crypto";

export function generatePublicKey(): string {
  return randomBytes(32).toString("base64url");
}
