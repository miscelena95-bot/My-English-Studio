import { describe, expect, it } from "vitest";
import { ProfileUpdateSchema, profileFromFormData } from "./profile";
import { CustomVocabSchema } from "./vocab";

function fd(entries: Array<[string, string]>) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("profile validation", () => {
  const base: Array<[string, string]> = [
    ["selfAssessedLevel", "B1+"],
    ["goals", "Write clear, natural English"],
    ["sessionMinutes", "25"],
    ["correctionStyle", "coaching"],
    ["structureBalance", "mixed"],
    ["speakingMode", "both"],
    ["weeklyGoalMinutes", "150"],
    ["weeklyGoalSessions", "5"],
  ];
  it("accepts valid preferences and drops unknown options", () => {
    const r = ProfileUpdateSchema.parse(profileFromFormData(fd([...base, ["interests", "Films"], ["interests", "Hacking"]])));
    expect(r.interests).toEqual(["Films"]);
    expect(r.name).toBeNull();
  });
  it("rejects out-of-range values with readable messages", () => {
    const r = ProfileUpdateSchema.safeParse(profileFromFormData(fd(base.map(([k, v]) => [k, k === "sessionMinutes" ? "5" : v]))));
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe("Sessions are at least 10 minutes.");
  });
  it("requires at least one goal and a valid level", () => {
    expect(ProfileUpdateSchema.safeParse(profileFromFormData(fd(base.filter(([k]) => k !== "goals")))).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse(profileFromFormData(fd(base.map(([k, v]) => [k, k === "selfAssessedLevel" ? "Z9" : v])))).success).toBe(false);
  });
});

describe("custom vocabulary validation", () => {
  it("splits lines and trims", () => {
    const r = CustomVocabSchema.parse({ phrase: "  touch base ", definition: "to contact someone briefly", examples: "Let's touch base.\n\n  We touched base. " });
    expect(r.phrase).toBe("touch base");
    expect(r.examples).toEqual(["Let's touch base.", "We touched base."]);
    expect(r.source).toBe("manual");
  });
  it("asks for an English definition", () => {
    const r = CustomVocabSchema.safeParse({ phrase: "touch base", definition: "" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toMatch(/definition in English/);
  });
});
