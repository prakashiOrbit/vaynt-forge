/**
 * Sprint 11 — a small line-based diff for Compare Requests. Deliberately not
 * Monaco/CodeMirror's merge view (the roadmap's original suggestion): this is
 * pure, dependency-free, and testable the same way every other engine module
 * is, and a line diff is all a request/response comparison actually needs.
 * LCS-based (classic diff algorithm), fine at the sizes requests/responses
 * actually reach (no chunking/windowing needed).
 */
export type DiffLineType = 'same' | 'added' | 'removed'

export interface DiffLine {
  type: DiffLineType
  text: string
}

export function diffLines(a: string, b: string): DiffLine[] {
  const linesA = a.split('\n')
  const linesB = b.split('\n')
  const n = linesA.length
  const m = linesB.length

  // lcs[i][j] = length of the longest common subsequence of linesA[i:] and linesB[j:]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        linesA[i] === linesB[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (linesA[i] === linesB[j]) {
      out.push({ type: 'same', text: linesA[i]! })
      i++
      j++
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ type: 'removed', text: linesA[i]! })
      i++
    } else {
      out.push({ type: 'added', text: linesB[j]! })
      j++
    }
  }
  while (i < n) {
    out.push({ type: 'removed', text: linesA[i]! })
    i++
  }
  while (j < m) {
    out.push({ type: 'added', text: linesB[j]! })
    j++
  }
  return out
}

export function linesAreIdentical(lines: DiffLine[]): boolean {
  return lines.every((l) => l.type === 'same')
}
