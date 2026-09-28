import type { ReactNode } from 'react'

/**
 * Minimal Markdown renderer for ChronoGuard's own reports and assistant answers:
 * headings, paragraphs, lists (one nested level), tables, block quotes, rules,
 * **bold**, *emphasis* and `code`. Everything becomes React elements; no raw HTML.
 */
function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = key
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) out.push(<strong key={i++} className="font-semibold text-white">{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`')) out.push(<code key={i++} className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[0.85em] text-accent">{tok.slice(1, -1)}</code>)
    else out.push(<em key={i++}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'))

export function Markdown({ source, compact = false }: { source: string; compact?: boolean }) {
  const lines = source.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let k = 0
  const gap = compact ? 'mt-2' : 'mt-4'

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      const cls =
        level === 1
          ? 'text-xl font-semibold text-white sm:text-2xl'
          : level === 2
            ? `${compact ? 'mt-3' : 'mt-8'} border-b border-line pb-2 text-base font-semibold text-white`
            : 'mt-4 text-sm font-semibold text-white'
      blocks.push(level === 1 ? <h1 key={k++} className={cls}>{inline(h[2])}</h1> : level === 2 ? <h2 key={k++} className={cls}>{inline(h[2])}</h2> : <h3 key={k++} className={cls}>{inline(h[2])}</h3>)
      i++
      continue
    }
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={k++} className={`${gap} border-line`} />)
      i++
      continue
    }
    if (line.startsWith('|')) {
      const rows: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++])
      const [head, , ...body] = rows
      blocks.push(
        <div key={k++} className={`${gap} overflow-x-auto rounded-xl border border-line`}>
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="bg-white/[0.03] text-xs text-muted">
              <tr>{cells(head).map((c, j) => <th key={j} className="px-3 py-2 font-semibold">{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-t border-line align-top">
                  {cells(r).map((c, j) => <td key={j} className="px-3 py-2 text-slate-300">{inline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    if (line.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''))
      blocks.push(
        <blockquote key={k++} className={`${gap} border-l-2 border-memory/50 pl-3 text-sm text-slate-300`}>
          {inline(quote.join(' '))}
        </blockquote>,
      )
      continue
    }
    const list = /^(\s*)([-*]|\d+\.)\s+/
    if (list.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: { text: string; sub: string[] }[] = []
      while (i < lines.length && (list.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        const indent = /^(\s*)/.exec(lines[i])![1].length
        const text = lines[i].replace(list, '').trim()
        if (indent >= 2 && items.length) items[items.length - 1].sub.push(text)
        else items.push({ text, sub: [] })
        i++
      }
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={k++} className={`${gap} space-y-1.5 pl-5 text-sm text-slate-300 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-muted`}>
          {items.map((it, j) => (
            <li key={j}>
              {inline(it.text)}
              {it.sub.length > 0 && (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-muted">
                  {it.sub.map((s, si) => <li key={si}>{inline(s)}</li>)}
                </ul>
              )}
            </li>
          ))}
        </Tag>,
      )
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#|\||>|---|\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++])
    blocks.push(<p key={k++} className={`${gap} text-sm leading-relaxed text-slate-300`}>{inline(para.join(' '))}</p>)
  }
  return <div>{blocks}</div>
}
