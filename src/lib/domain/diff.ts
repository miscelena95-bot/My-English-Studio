/** Word-level diff (LCS) used to compare drafts and show corrections. */
export type DiffPart = { type: "same" | "added" | "removed"; text: string };

export function diffWords(a: string, b: string): DiffPart[] {
  const A = a.split(/(\s+)/).filter((x) => x !== "");
  const B = b.split(/(\s+)/).filter((x) => x !== "");
  const n = A.length;
  const m = B.length;
  // Guard against pathological sizes (very long texts): fall back to a coarse diff.
  if (n * m > 4_000_000) return [{ type: "removed", text: a }, { type: "added", text: b }];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push("same", A[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("removed", A[i++]);
    else push("added", B[j++]);
  }
  while (i < n) push("removed", A[i++]);
  while (j < m) push("added", B[j++]);
  return out;
}
