import type { Metadata } from "next";
import { getProfile } from "@/lib/server/profile";
import { aiStatus } from "@/lib/ai";
import { newsConfigured } from "@/lib/server/news";
import { Badge, PageHeader } from "@/components/ui";
import { AiQuota } from "@/components/ai/AiQuota";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { VoiceSettings } from "@/components/settings/VoiceSettings";
import { BreakControl, DeleteControls } from "@/components/settings/DataControls";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const p = await getProfile();
  const ai = aiStatus();
  return (
    <div className="page page-narrow">
      <PageHeader eyebrow="Settings" title="Your studio, your way" lede="Everything you chose during onboarding can be changed here." />
      <div className="stack-l">
        <SettingsForm d={p} />

        <section className="card stack" aria-labelledby="s-break">
          <h2 id="s-break">Breaks</h2>
          <p className="small muted">Busy week or holiday? Pause your goals. Your history, collection and progress stay exactly as they are, and your streak isn&apos;t broken by days inside the break.</p>
          <BreakControl breakUntil={p.breakUntil} />
        </section>

        <section className="card stack" id="ai" aria-labelledby="s-ai">
          <h2 id="s-ai">AI tutor</h2>
          <p className="row">
            Status: {ai.configured ? <Badge tone="success">Configured · {ai.provider} · {ai.model}</Badge> : <Badge tone="warning">Not configured</Badge>}
          </p>
          <p className="small">
            The AI tutor powers conversations, conversation reports, writing feedback, checking open answers and building activities from articles. It runs only on the server; the API key is never sent to the browser.
          </p>
          {ai.configured && <AiQuota detailed />}
          {!ai.configured && (
            <div className="stack-s small">
              <p className="mb-0"><strong>Free option — Google Gemini:</strong></p>
              <ol className="mb-0">
                <li>Open <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">Google AI Studio → API keys</a> and create a key (the free tier needs no card — don&apos;t set up billing unless you want to pay).</li>
                <li>Add it as <code>GEMINI_API_KEY</code>: on Vercel in <em>Settings → Environment Variables</em>, then redeploy; locally in <code>.env.local</code>, then restart the app.</li>
                <li>Optional: <code>AI_MODEL</code> (default <code>gemini-3.8-flash</code>) and <code>AI_FALLBACK_MODEL</code> (default <code>gemini-3.6-flash</code>, used when the first model&apos;s daily quota runs out).</li>
              </ol>
              <p className="mb-0"><strong>Paid option — Anthropic Claude:</strong> create a key at <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">console.anthropic.com</a> and add it as <code>ANTHROPIC_API_KEY</code> the same way (optional <code>AI_MODEL</code>, default <code>claude-opus-5-5</code>).</p>
            </div>
          )}
          <p className="tiny muted">Privacy: your messages and writing are sent to the AI provider to generate feedback. Check your provider&apos;s data-retention terms — don&apos;t assume a particular policy. On free tiers (such as Gemini&apos;s), providers may use what you send to improve their products, and people may review it. Avoid including confidential client details in practice texts.</p>
        </section>

        <section className="card stack" aria-labelledby="s-voice">
          <h2 id="s-voice">Voice</h2>
          <VoiceSettings voiceName={p.voiceName} rate={p.speechRate} />
        </section>

        <section className="card stack" aria-labelledby="s-news">
          <h2 id="s-news">News</h2>
          <p className="row">Status: {newsConfigured() ? <Badge tone="success">The Guardian Open Platform configured</Badge> : <Badge>Not configured</Badge>}</p>
          <p className="small">
            Set <code>GUARDIAN_API_KEY</code> (free developer key from <a href="https://open-platform.theguardian.com/access/" target="_blank" rel="noreferrer">open-platform.theguardian.com</a>) to see recent articles with dates, attribution and links. Without it, Real English uses prepared activities — no news is ever invented.
          </p>
        </section>

        <section className="card stack" aria-labelledby="s-data">
          <h2 id="s-data">Your data</h2>
          <p className="small">
            Everything is stored in the app&apos;s own database: a SQLite file on the machine running the app, or your Turso database when deployed to Vercel. Only text is stored (never audio). The only personal detail collected is the optional name above.
          </p>
          <p><a className="btn btn-small" href="/api/export" download>Download all my data (JSON)</a></p>
          <DeleteControls />
        </section>
      </div>
    </div>
  );
}
