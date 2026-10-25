"use client";

import { useState } from "react";
import Link from "next/link";
import { saveExpression } from "@/app/actions/vocab";
import { Button, Notice } from "@/components/ui";

export function AddExpressionForm() {
  const [result, setResult] = useState<{ ok: boolean; msg: string; id?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        const r = await saveExpression({
          phrase: fd.get("phrase"),
          definition: fd.get("definition"),
          partOfSpeech: fd.get("partOfSpeech") || undefined,
          examples: fd.get("examples") || undefined,
          collocations: fd.get("collocations") || undefined,
          synonyms: fd.get("synonyms") || undefined,
          register: fd.get("register") || undefined,
          personalNotes: fd.get("personalNotes") || undefined,
          source: "manual",
        });
        setBusy(false);
        if (r.ok) {
          setResult({ ok: true, msg: r.data.created ? "Saved. It's in your collection and due for its first review." : "You already have this expression — it's in your collection.", id: r.data.id });
          (e.target as HTMLFormElement).reset();
        } else setResult({ ok: false, msg: r.error });
      }}
    >
      {result && (
        <Notice tone={result.ok ? "success" : "error"}>
          {result.msg} {result.id && <Link href={`/vocabulary/collection/${result.id}`}>Open it</Link>}
        </Notice>
      )}
      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="phrase">Word or expression *</label>
          <input id="phrase" name="phrase" className="input" required minLength={2} maxLength={120} placeholder="e.g. touch base" />
        </div>
        <div className="field">
          <label className="label" htmlFor="pos">Type</label>
          <input id="pos" name="partOfSpeech" className="input" placeholder="phrase, phrasal verb, noun…" maxLength={40} />
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="definition">Definition in English *</label>
        <input id="definition" name="definition" className="input" required minLength={3} maxLength={300} placeholder="to contact someone briefly to check how things are going" />
        <span className="help">Write it in simple English rather than translating — it trains you to think in English.</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="examples">Example sentences (one per line)</label>
        <textarea id="examples" name="examples" className="textarea" style={{ minHeight: 80 }} placeholder="Let's touch base next week about the venue." />
        <span className="help">Include the expression exactly as written above so it can be used in gap-fill reviews.</span>
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="collocations">Collocations (one per line)</label>
          <textarea id="collocations" name="collocations" className="textarea" style={{ minHeight: 70 }} />
        </div>
        <div className="field">
          <label className="label" htmlFor="synonyms">Synonyms (one per line)</label>
          <textarea id="synonyms" name="synonyms" className="textarea" style={{ minHeight: 70 }} />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="register">Register</label>
          <select id="register" name="register" className="select" defaultValue="">
            <option value="">—</option><option>neutral</option><option>formal</option><option>informal</option><option>spoken</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="personalNotes">Notes</label>
          <input id="personalNotes" name="personalNotes" className="input" maxLength={1000} />
        </div>
      </div>
      <div><Button type="submit" variant="primary" disabled={busy}>Save expression</Button></div>
    </form>
  );
}
