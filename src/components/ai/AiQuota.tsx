import { aiStatus } from "@/lib/ai";
import { aiUsageToday } from "@/lib/server/ai-usage";
import { ProgressBar } from "@/components/ui";

/**
 * Today's AI requests against the free daily quota (Gemini only). The count
 * covers requests made by this app; Google's own dashboard is authoritative.
 */
export async function AiQuota({ detailed }: { detailed?: boolean }) {
  const ai = aiStatus();
  if (!ai.quota) return null;
  const usage = await aiUsageToday(ai.quota.models);
  const used = usage.reduce((n, u) => n + u.requests, 0);
  const limit = ai.quota.perModelLimit * usage.length;
  const left = Math.max(0, limit - used);
  return (
    <div className="stack-s" data-testid="ai-quota">
      <p className="small mb-0">
        <strong>Free AI requests today: {used} of about {limit} used</strong>
        {left === 0 ? " — come back after 9:00 (Italian time)." : ` · about ${left} left`}
      </p>
      <ProgressBar value={used} max={limit} label="AI requests used today" thin tone={left === 0 ? "clay" : undefined} />
      {detailed && (
        <p className="tiny muted mb-0">
          {usage.map((u) => `${u.model}: ${u.requests}/${ai.quota!.perModelLimit}`).join(" · ")}. Each message to the tutor, conversation report, writing feedback or answer check uses one request. The app switches to the second model when the first one runs out. Limits reset at midnight Pacific time (about 9:00 in Italy); Google AI Studio shows the exact figures.
        </p>
      )}
    </div>
  );
}
