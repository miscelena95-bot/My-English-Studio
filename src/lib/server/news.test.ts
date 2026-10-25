import { describe, expect, it } from "vitest";
import { parseGuardian } from "./news";

describe("Guardian parsing", () => {
  it("keeps attribution fields and strips HTML", () => {
    const items = parseGuardian({
      response: {
        results: [
          { id: "a/1", webTitle: "Title &amp; more", webUrl: "https://www.theguardian.com/a/1", webPublicationDate: "2026-10-01T10:00:00Z", sectionName: "Travel", fields: { trailText: "<p>Short <b>standfirst</b></p>", bodyText: "word ".repeat(600) } },
          { id: "b/2", webTitle: "No URL" },
          { id: "c/3", webTitle: "Insecure", webUrl: "http://example.com", webPublicationDate: "2026-10-01" },
        ],
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Title & more", standfirst: "Short standfirst", publishedAt: "2026-10-01T10:00:00Z", section: "Travel" });
    expect(items[0].excerpt.split(" ")).toHaveLength(450);
  });
  it("returns nothing for unexpected payloads", () => {
    expect(parseGuardian(null)).toEqual([]);
    expect(parseGuardian({ response: { results: "x" } })).toEqual([]);
  });
});
