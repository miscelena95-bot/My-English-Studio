import type { Metadata } from "next";
import { getProfile } from "@/lib/server/profile";
import { aiStatus } from "@/lib/ai";
import { newsConfigured } from "@/lib/server/news";
import { Badge, PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { VoiceSettings } from "@/components/settings/VoiceSettings";
import { BreakControl, DeleteControls } from "@/components/settings/DataControls";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  const p = getProfile();
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
          {!ai.configured && (
            <ol className="small">
              <li>Create an API key at <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">console.anthropic.com</a> (paid usage).</li>
              <li>Copy <code>.env.example</code> to <code>.env.local</code> and set <code>ANTHROPIC_API_KEY=…</code>.</li>
              <li>Optional: set <code>AI_MODEL</code> (default <code>claude-opus-5-5</code>).</li>
              <li>Restart the app (<code>npm run dev</code> or <code>npm start</code>).</li>
            </ol>
          )}
          <p className="tiny muted">Privacy: your messages and writing are sent to the AI provider to generate feedback. Check your provider&apos;s data-retention terms — don&apos;t assume a particular policy. Avoid including confidential client details in practice texts.</p>
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
            Everything is stored locally in a SQLite database on the machine running the app. Only text is stored (never audio). The only personal detail collected is the optional name above.
          </p>
          <p><a className="btn btn-small" href="/api/export" download>Download all my data (JSON)</a></p>
          <DeleteControls />
        </section>
      </div>
    </div>
  );
}
