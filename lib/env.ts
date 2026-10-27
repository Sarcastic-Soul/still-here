import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Scripts run with bun from the repo root; secrets live one folder up in week4/.env.
const secrets = resolve(process.cwd(), "../.env");
if (!process.env.DATABASE_URL && existsSync(secrets)) process.loadEnvFile(secrets);

export function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export function maybe(name: string): string | undefined {
  return process.env[name] || undefined;
}
