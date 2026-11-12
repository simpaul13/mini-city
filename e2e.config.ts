import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { gateway } from "ai";

export default {
  tests: "tests/**/*.e2e.ts",
  workers: 1,
  timeout: 180_000,
  assertionTimeout: 15_000,
  agents: {
    default: {
      // Only agent steps call the model; the smoke suite needs no credentials.
      model: gateway(process.env.E2E_MODEL ?? "openai/gpt-6-luna-fast"),
    },
  },
  targets: [{
    name: "desktop-chromium",
    engine: web({
      viewport: { width: 1440, height: 900 },
      locale: "en-US",
      colorScheme: "light",
    }),
    app: {
      url: "http://127.0.0.1:0",
      command: {
        executable: process.execPath,
        args: ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "{port}", "--strictPort"],
        log: ".e2e/logs/app.log",
      },
    },
  }],
} satisfies E2EConfig;
