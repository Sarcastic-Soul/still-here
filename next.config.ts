import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Secrets live in week4/.env, one folder up, so they never sit inside the repo.
// On Vercel the same names are set as project environment variables instead.
const secrets = resolve(process.cwd(), "../.env");
if (existsSync(secrets)) process.loadEnvFile(secrets);

const nextConfig: NextConfig = {
  devIndicators: false,
  // Runs the embedding model with the native ONNX runtime, so keep it out of the bundle
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
