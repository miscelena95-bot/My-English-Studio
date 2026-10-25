export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <div className="row muted small"><span className="spinner" /> Loading…</div>
    </div>
  );
}
