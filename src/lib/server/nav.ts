import "server-only";
import { dueCount } from "./vocabulary";
import { activeMistakeCount } from "./mistakes";

export function getNavCounts() {
  return { dueReviews: dueCount(), activeMistakes: activeMistakeCount() };
}
