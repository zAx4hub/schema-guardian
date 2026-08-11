import { describe, it, expect } from "vitest";
import { run, demo, inspect, diffTables } from "../src/engine";

describe("schema-guardian", () => {
  it("demo + inspect", () => {
    expect(demo().allowed).toBe(false);
    expect(inspect().name).toBe("schema-guardian");
  });
  it("blocks drop column", () => {
    const r = run({
      before: [{ name: "t", columns: [{ name: "a", type: "int" }, { name: "b", type: "int" }] }],
      after: [{ name: "t", columns: [{ name: "a", type: "int" }] }],
    });
    expect(r.allowed).toBe(false);
  });
  it("allows additive", () => {
    const d = diffTables(
      [{ name: "t", columns: [{ name: "a", type: "int" }] }],
      [{ name: "t", columns: [{ name: "a", type: "int" }, { name: "b", type: "text", nullable: true }] }]
    );
    expect(d.every((x) => x.severity !== "block")).toBe(true);
  });
});
