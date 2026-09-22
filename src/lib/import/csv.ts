/**
 * RFC 4180 CSV reading and writing, tolerant of what spreadsheet apps produce: a UTF-8 BOM, CRLF or LF line
 * ends, a trailing newline, and ';' as the delimiter (Greek / European Excel) detected from the header line.
 */

export type Delimiter = ',' | ';' | '\t'
export type CSVCell = string | number | boolean | null | undefined

const BOM = '﻿'
const stripBom = (s: string): string => (s.startsWith(BOM) ? s.slice(1) : s)

/** ',' unless the header line (outside quotes) has no commas but has ';' (or, failing that, tabs). */
export function detectDelimiter(text: string): Delimiter {
  const counts: Record<Delimiter, number> = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (const ch of stripBom(text)) {
    if (ch === '"') quoted = !quoted
    else if (quoted) continue
    else if (ch === '\n' || ch === '\r') break
    else if (ch === ',' || ch === ';' || ch === '\t') counts[ch]++
  }
  if (counts[','] > 0) return ','
  if (counts[';'] > 0) return ';'
  return counts['\t'] > 0 ? '\t' : ','
}

/**
 * Parse CSV text into rows of raw (untrimmed) cells. A blank line is a row with one empty cell; the final line
 * break does not start a new row. Line breaks inside quoted cells are kept (CRLF normalised to LF).
 * Malformed quoting is read leniently rather than rejected: text after a closing quote is appended, and an
 * unterminated quote runs to the end of the input.
 */
export function parseCSV(text: string, delimiter?: Delimiter): string[][] {
  const src = stripBom(text)
  const d = delimiter ?? detectDelimiter(src)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let atFieldStart = true
  const endField = () => {
    row.push(field)
    field = ''
    atFieldStart = true
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else if (ch === '\r' && src[i + 1] === '\n') {
        field += '\n'
        i++
      } else field += ch
    } else if (ch === '"' && atFieldStart) {
      quoted = true
      atFieldStart = false
    } else if (ch === d) endField()
    else if (ch === '\n' || ch === '\r') {
      endField()
      rows.push(row)
      row = []
      if (ch === '\r' && src[i + 1] === '\n') i++
    } else {
      field += ch
      atFieldStart = false
    }
  }
  if (!atFieldStart || row.length > 0) {
    endField()
    rows.push(row)
  }
  return rows
}

/** Quote a cell when it holds a delimiter candidate, a quote, a line break, or edge whitespace. */
function cell(v: CSVCell): string {
  const s = v == null ? '' : String(v)
  return /[",;\t\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Serialise rows as CSV with CRLF line ends and a final line break. `bom: true` prepends a UTF-8 BOM so Excel
 * opens Greek text correctly; `delimiter: ';'` suits Excel in Greek / European locales.
 */
export function toCSV(rows: readonly (readonly CSVCell[])[], opts: { delimiter?: Delimiter; bom?: boolean } = {}): string {
  const d = opts.delimiter ?? ','
  const body = rows.map((r) => r.map(cell).join(d) + '\r\n').join('')
  return (opts.bom ? BOM : '') + body
}

/** Header cell -> lookup key: lower case, trimmed, spaces and dashes as '_' ("Warm-up Sets" -> "warm_up_sets"). */
export const normalizeHeader = (h: string): string =>
  stripBom(h)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

/** True for a row whose cells are all empty or whitespace. */
export const isBlankRow = (r: readonly string[]): boolean => r.every((c) => !c.trim())

/**
 * Map each wanted column to its index in the header row, using normalizeHeader and optional aliases
 * (normalized alias -> column). The first matching header cell wins; missing columns are absent.
 */
export function headerIndex<C extends string>(
  header: readonly string[],
  columns: readonly C[],
  aliases: Readonly<Record<string, C>> = {},
): Partial<Record<C, number>> {
  const known = new Set<string>(columns)
  const out: Partial<Record<C, number>> = {}
  header.forEach((h, i) => {
    const key = normalizeHeader(h)
    const c = (known.has(key) ? key : aliases[key]) as C | undefined
    if (c && out[c] == null) out[c] = i
  })
  return out
}
