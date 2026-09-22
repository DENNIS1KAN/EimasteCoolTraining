/**
 * Plan notes are plain text with a tiny markup the coach can type on a phone:
 *   "# Heading"   a heading (also "## " / "### ")
 *   "- item"      a bullet ("* " and "• " work too); consecutive bullets form one list
 *   blank line    starts a new paragraph; other consecutive lines stay together, one per line
 */
export type NoteBlock = { kind: 'heading'; text: string } | { kind: 'list'; items: string[] } | { kind: 'para'; lines: string[] }

const HEADING = /^#{1,3}(?:\s+(.*))?$/
const BULLET = /^[-*•](?:\s+(.*))?$/

export function parseNotes(src: string | null | undefined): NoteBlock[] {
  const out: NoteBlock[] = []
  let list: string[] | null = null
  let para: string[] | null = null
  const close = () => {
    if (list) out.push({ kind: 'list', items: list })
    if (para) out.push({ kind: 'para', lines: para })
    list = null
    para = null
  }
  for (const raw of (src ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) {
      close()
      continue
    }
    const h = HEADING.exec(line)
    if (h) {
      close()
      if (h[1]?.trim()) out.push({ kind: 'heading', text: h[1].trim() })
      continue
    }
    const b = BULLET.exec(line)
    if (b) {
      if (para) close()
      list = list ?? []
      if (b[1]?.trim()) list.push(b[1].trim())
      continue
    }
    if (list) close()
    para = para ?? []
    para.push(line)
  }
  close()
  return out.filter((b) => b.kind !== 'list' || b.items.length > 0)
}
