"use server";

import { revalidatePath } from "next/cache";
import { addCustom, addFromLibrary, addSet, deleteEntry, updateEntry } from "@/lib/server/vocabulary";
import { CustomVocabSchema } from "@/lib/validation/vocab";
import { run } from "./result";

export async function addVocabSet(setId: string) {
  return run(() => {
    const r = addSet(setId);
    revalidatePath("/", "layout");
    return { added: r.filter((x) => x.created).length, total: r.length };
  });
}

export async function saveLibraryExpression(key: string, source = "seed", sourceRef?: string) {
  return run(() => {
    const r = addFromLibrary(key, source, sourceRef);
    revalidatePath("/", "layout");
    return r;
  });
}

/** Save an expression from any module (feedback, reports, content) or typed by the learner. */
export async function saveExpression(input: unknown) {
  return run(() => {
    const data = CustomVocabSchema.parse(input);
    const r = addCustom(data);
    revalidatePath("/", "layout");
    return r;
  });
}

export async function updateVocabNotes(id: number, notes: string) {
  return run(() => {
    updateEntry(id, { personalNotes: notes.slice(0, 1000) || null });
    revalidatePath(`/vocabulary/collection/${id}`);
    return true;
  });
}

export async function archiveVocab(id: number, archived: boolean) {
  return run(() => {
    updateEntry(id, { archived });
    revalidatePath("/", "layout");
    return true;
  });
}

export async function deleteVocab(id: number) {
  return run(() => {
    deleteEntry(id);
    revalidatePath("/", "layout");
    return true;
  });
}
