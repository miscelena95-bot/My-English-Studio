import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const req = (auth?: string) => new NextRequest("https://studio.example/", { headers: auth ? { authorization: auth } : {} });
const basic = (pass: string) => `Basic ${btoa(`me:${pass}`)}`;

afterEach(() => vi.unstubAllEnvs());

describe("access protection", () => {
  it("is open locally when no passcode is set", () => {
    vi.stubEnv("STUDIO_PASSCODE", "");
    vi.stubEnv("VERCEL", "");
    expect(proxy(req()).status).toBe(200);
  });
  it("stays locked on Vercel without a passcode, unless made public deliberately", () => {
    vi.stubEnv("STUDIO_PASSCODE", "");
    vi.stubEnv("VERCEL", "1");
    expect(proxy(req()).status).toBe(503);
    vi.stubEnv("STUDIO_PUBLIC", "1");
    expect(proxy(req()).status).toBe(200);
  });
  it("requires the right passcode when one is set", () => {
    vi.stubEnv("STUDIO_PASSCODE", "genova-2026");
    expect(proxy(req()).status).toBe(401);
    expect(proxy(req()).headers.get("www-authenticate")).toContain("Basic");
    expect(proxy(req(basic("wrong"))).status).toBe(401);
    expect(proxy(req(basic("genova-2026"))).status).toBe(200);
  });
});
