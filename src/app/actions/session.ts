"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { completeDailySession, startDailySession } from "@/lib/server/insights";
import { run } from "./result";

export async function startToday(formData: FormData) {
  const m = Number(formData.get("minutes"));
  startDailySession([10, 25, 40].includes(m) ? m : undefined);
  revalidatePath("/", "layout");
  redirect("/session");
}

export async function finishToday(id: number, reflection: { difficulty?: string; note?: string }) {
  return run(() => {
    completeDailySession(id, reflection);
    revalidatePath("/", "layout");
    return true;
  });
}
