import type { RealEnglishCategory, RealEnglishUnit } from "./types";
import { REAL_ENGLISH_UNIT_LIST } from "./units";

export const REAL_ENGLISH_UNITS: RealEnglishUnit[] = REAL_ENGLISH_UNIT_LIST;

export const CATEGORY_INFO: Record<RealEnglishCategory, { label: string; interest: string }> = {
  news: { label: "News & current affairs", interest: "Current affairs" },
  "film-tv": { label: "Film & television", interest: "Films" },
  music: { label: "Music", interest: "Music" },
  literature: { label: "Literature", interest: "Literature" },
  travel: { label: "Travel & culture", interest: "Travel" },
  psychology: { label: "Psychology & personal development", interest: "Psychology" },
  business: { label: "Business English", interest: "Business English" },
};

export function getUnit(id: string) {
  return REAL_ENGLISH_UNITS.find((u) => u.id === id);
}

export type { RealEnglishUnit, RealEnglishCategory };
