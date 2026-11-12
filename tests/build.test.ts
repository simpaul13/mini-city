import { build } from "vite";
import { expect, it } from "vitest";

it("builds a separate Three.js chunk without oversized JavaScript chunks", async () => {
  const result = await build({ build: { write: false }, logLevel: "silent" });
  const outputs = Array.isArray(result) ? result : [result];
  const chunks = outputs.flatMap((output) => output.output).filter((item) => item.type === "chunk");
  const entry = chunks.find((chunk) => chunk.isEntry);
  const three = chunks.find((chunk) => chunk.name === "three");

  expect(entry).toBeDefined();
  expect(three).toBeDefined();
  expect(entry!.imports).toContain(three!.fileName);
  for (const chunk of chunks) {
    expect(Buffer.byteLength(chunk.code), chunk.fileName).toBeLessThanOrEqual(500_000);
  }
}, 30_000);
