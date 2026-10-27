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
  // The runtime ships GPU providers and builds for every OS. A Vercel function holds 250 MB,
  // and only the linux x64 CPU build is used, so leave the rest out of the trace.
  // transformers loads the runtime with a dynamic import the tracer can't follow
  outputFileTracingIncludes: {
    "/**": [
      "node_modules/onnxruntime-node/package.json",
      "node_modules/onnxruntime-node/dist/**",
      "node_modules/onnxruntime-node/bin/napi-v*/linux/x64/{onnxruntime_binding.node,libonnxruntime.so.1,libonnxruntime_providers_shared.so}",
    ],
  },
  outputFileTracingExcludes: {
    "/**": [
      "node_modules/onnxruntime-node/bin/napi-v*/linux/x64/libonnxruntime_providers_{cuda,tensorrt}.so",
      "node_modules/onnxruntime-node/bin/napi-v*/{darwin,win32}/**",
      "node_modules/onnxruntime-node/bin/napi-v*/linux/arm64/**",
      "node_modules/onnxruntime-web/**",
    ],
  },
};

export default nextConfig;
