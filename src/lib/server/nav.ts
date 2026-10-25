import "server-only";
import { dueCount } from "./vocabulary";
import { activeMistakeCount } from "./mistakes";

export async function getNavCounts() {
  const [dueReviews, activeMistakes] = await Promise.all([dueCount(), activeMistakeCount()]);
  return { dueReviews, activeMistakes };
}
