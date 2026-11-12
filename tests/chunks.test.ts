import { describe, expect, it } from "vitest";
import { vendorChunk } from "../build/chunks";

describe("production chunk assignment", () => {
  it("places Three.js modules in the shared vendor chunk on Unix and Windows", () => {
    expect(vendorChunk("/project/node_modules/three/build/three.module.js")).toBe("three");
    expect(vendorChunk("C:\\project\\node_modules\\three\\src\\Three.js")).toBe("three");
  });

  it("leaves application and unrelated packages to Rollup", () => {
    expect(vendorChunk("/project/src/world.ts")).toBeUndefined();
    expect(vendorChunk("/project/node_modules/three-extra/index.js")).toBeUndefined();
    expect(vendorChunk("/project/node_modules/simplex-noise/dist/esm/simplex-noise.js")).toBeUndefined();
  });
});
