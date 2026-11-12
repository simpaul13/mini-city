import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { vendorChunk } from "./build/chunks";

export default defineConfig({
  plugins: [tailwindcss()],
  build: { rollupOptions: { output: { manualChunks: vendorChunk } } },
});
