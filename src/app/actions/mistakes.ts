"use server";

import { revalidatePath } from "next/cache";
import { dismissMistake } from "@/lib/server/mistakes";
import { run } from "./result";

export async function removeMistake(id: number) {
  return run(async () => {
    await dismissMistake(id);
    revalidatePath("/", "layout");
    return true;
  });
}
