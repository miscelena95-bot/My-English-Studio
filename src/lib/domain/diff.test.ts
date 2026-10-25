import { describe, expect, it } from "vitest";
import { diffWords } from "./diff";

describe("diffWords", () => {
  it("marks added and removed words", () => {
    const d = diffWords("It depends from the budget.", "It depends on the budget.");
    expect(d.filter((p) => p.type === "removed").map((p) => p.text.trim())).toEqual(["from"]);
    expect(d.filter((p) => p.type === "added").map((p) => p.text.trim())).toEqual(["on"]);
    expect(d.map((p) => (p.type === "removed" ? "" : p.text)).join("")).toBe("It depends on the budget.");
  });
  it("handles identical and empty texts", () => {
    expect(diffWords("same text", "same text")).toEqual([{ type: "same", text: "same text" }]);
    expect(diffWords("", "new")).toEqual([{ type: "added", text: "new" }]);
  });
});
