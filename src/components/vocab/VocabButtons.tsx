"use client";

import { useState } from "react";
import { addVocabSet, archiveVocab, deleteVocab, saveExpression, saveLibraryExpression, updateVocabNotes } from "@/app/actions/vocab";
import { Button } from "@/components/ui";
import { IconBookmark, IconCheck } from "@/components/ui/icons";
import { useRouter } from "next/navigation";

export function AddSetButton({ setId, inCollection, total }: { setId: string; inCollection: number; total: number }) {
  const [state, setState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  if (inCollection >= total)
    return (
      <span className="row">
        <span className="badge badge-success"><IconCheck size={14} /> All {total} in your collection</span>
        {state && <span className="small" role="status">{state}</span>}
      </span>
    );
  return (
    <span className="row">
      <Button
        variant="primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await addVocabSet(setId);
          setBusy(false);
          setState(r.ok ? `Added ${r.data.added} expressions. They're due for their first review now.` : r.error);
          router.refresh();
        }}
      >
        Add {total - inCollection === total ? "all" : `the other ${total - inCollection}`} to my collection
      </Button>
      {state && <span className="small" role="status">{state}</span>}
    </span>
  );
}

/** Save one library expression (from content, grammar, lessons…). */
export function SaveLibraryButton({ libraryKey, saved, source = "seed", sourceRef }: { libraryKey: string; saved: boolean; source?: string; sourceRef?: string }) {
  const [done, setDone] = useState(saved);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      <Button size="small" variant="ghost" disabled={done} aria-label={done ? "Saved to your collection" : "Save to your collection"} onClick={async () => { const r = await saveLibraryExpression(libraryKey, source, sourceRef); if (r.ok) setDone(true); else setErr(r.error); }}>
        {done ? <><IconCheck size={14} /> Saved</> : <><IconBookmark size={14} /> Save</>}
      </Button>
      {err && <span className="field-error">{err}</span>}
    </span>
  );
}

/** Save any expression from feedback (speaking reports, writing feedback, articles). */
export function SaveExpressionButton({ phrase, definition, example, source, sourceRef }: { phrase: string; definition: string; example?: string; source: "speaking" | "writing" | "real-english" | "grammar" | "mistakes" | "manual"; sourceRef?: string }) {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      <Button
        size="small"
        variant="ghost"
        disabled={done}
        onClick={async () => {
          const r = await saveExpression({ phrase, definition: definition.length >= 3 ? definition : `${definition} (expression)`, examples: example ?? "", source, sourceRef });
          if (r.ok) setDone(true);
          else setErr(r.error);
        }}
      >
        {done ? <><IconCheck size={14} /> Saved</> : <><IconBookmark size={14} /> Save expression</>}
      </Button>
      {err && <span className="field-error"> {err}</span>}
    </span>
  );
}

export function NotesEditor({ id, notes }: { id: number; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="stack-s">
      <label className="label" htmlFor="notes">Personal notes</label>
      <textarea id="notes" className="textarea" style={{ minHeight: 90 }} value={value} onChange={(e) => { setValue(e.target.value); setMsg(null); }} placeholder="Where did you meet it? A sentence of your own? A memory trick?" />
      <div className="row">
        <Button size="small" onClick={async () => { const r = await updateVocabNotes(id, value); setMsg(r.ok ? "Saved." : r.error); }}>Save notes</Button>
        {msg && <span className="small" role="status">{msg}</span>}
      </div>
    </div>
  );
}

export function EntryActions({ id, archived }: { id: number; archived: boolean }) {
  const router = useRouter();
  return (
    <div className="row">
      <Button size="small" onClick={async () => { await archiveVocab(id, !archived); router.refresh(); }}>{archived ? "Restore to reviews" : "Archive (stop reviewing)"}</Button>
      <Button size="small" variant="danger" onClick={async () => { if (confirm("Delete this expression and its review history?")) { await deleteVocab(id); router.push("/vocabulary/collection"); } }}>Delete</Button>
    </div>
  );
}
