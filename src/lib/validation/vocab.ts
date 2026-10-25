import { z } from "zod";

const lines = z
  .string()
  .optional()
  .transform((s) =>
    (s ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 10),
  );

export const VOCAB_SOURCES = ["manual", "grammar", "speaking", "writing", "real-english", "mistakes", "seed"] as const;

export const CustomVocabSchema = z.object({
  phrase: z.string().trim().min(2, "Enter the word or expression.").max(120, "Keep it under 120 characters."),
  definition: z.string().trim().min(3, "Add a short definition in English — it helps you think in English.").max(300),
  partOfSpeech: z.string().trim().max(40).optional().transform((v) => v || null),
  examples: lines,
  collocations: lines,
  synonyms: lines,
  register: z.string().trim().max(40).optional().transform((v) => v || null),
  personalNotes: z.string().trim().max(1000).optional().transform((v) => v || null),
  source: z.enum(VOCAB_SOURCES).default("manual"),
  sourceRef: z.string().max(200).optional().nullable(),
});

export type CustomVocabInput = z.infer<typeof CustomVocabSchema>;
