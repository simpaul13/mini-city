import { it, expect } from "vitest";
import { roadLine } from "./roads";
it("draws continuous cardinal road cells across signed chunk edges", () => {
  const line = roadLine(-34, -1, 34, 1);
  expect(line[0]).toEqual([-34, -1]);
  expect(line.at(-1)).toEqual([34, 1]);
  line
    .slice(1)
    .forEach(([x, z], i) =>
      expect(Math.abs(x - line[i][0]) + Math.abs(z - line[i][1])).toBe(1),
    );
});
