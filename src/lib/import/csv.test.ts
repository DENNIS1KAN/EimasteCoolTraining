import { describe, expect, it } from 'vitest'
import { detectDelimiter, headerIndex, isBlankRow, normalizeHeader, parseCSV, toCSV } from './csv'

describe('parseCSV', () => {
  it('splits simple rows', () => {
    expect(parseCSV('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('handles CRLF, a trailing newline and an old-Mac CR', () => {
    expect(parseCSV('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCSV('a,b\r1,2\r')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('strips a UTF-8 BOM', () => {
    expect(parseCSV('﻿week,day\n1,Upper')[0]).toEqual(['week', 'day'])
  })

  it('reads quoted cells with delimiters, escaped quotes and line breaks', () => {
    const text = 'name,note\n"Press, incline","He said ""pause""\nthen go"\r\n"",x'
    expect(parseCSV(text)).toEqual([
      ['name', 'note'],
      ['Press, incline', 'He said "pause"\nthen go'],
      ['', 'x'],
    ])
  })

  it('normalises CRLF inside quoted cells to LF', () => {
    expect(parseCSV('a\r\n"line1\r\nline2"\r\n')).toEqual([['a'], ['line1\nline2']])
  })

  it('keeps empty cells, including trailing ones', () => {
    expect(parseCSV('a,,c,\n,,,')).toEqual([
      ['a', '', 'c', ''],
      ['', '', '', ''],
    ])
  })

  it('keeps blank lines as a row with one empty cell (so row numbers stay true)', () => {
    expect(parseCSV('a\n\nb\n')).toEqual([['a'], [''], ['b']])
  })

  it('returns no rows for empty input', () => {
    expect(parseCSV('')).toEqual([])
    expect(parseCSV('﻿')).toEqual([])
  })

  it('does not trim (spaces are data) and treats a quote inside an unquoted cell literally', () => {
    expect(parseCSV(' a , b"c ')).toEqual([[' a ', ' b"c ']])
  })

  it('is lenient with malformed quoting', () => {
    expect(parseCSV('"abc"def,x')).toEqual([['abcdef', 'x']])
    expect(parseCSV('"unterminated,x\ny')).toEqual([['unterminated,x\ny']])
  })

  it("auto-detects ';' when the header has no commas (Greek Excel)", () => {
    expect(parseCSV('week;day;exercise\n1;Upper;"Press; heavy"\n')).toEqual([
      ['week', 'day', 'exercise'],
      ['1', 'Upper', 'Press; heavy'],
    ])
    // decimal commas in the data do not confuse detection, which only looks at the header
    expect(parseCSV('weight;reps\n57,5;8')).toEqual([
      ['weight', 'reps'],
      ['57,5', '8'],
    ])
  })

  it('uses an explicit delimiter when given', () => {
    expect(parseCSV('a;b,c', ',')).toEqual([['a;b', 'c']])
    expect(parseCSV('a\tb', '\t')).toEqual([['a', 'b']])
  })
})

describe('detectDelimiter', () => {
  it('prefers commas, then semicolons, then tabs, ignoring quoted text', () => {
    expect(detectDelimiter('a,b;c')).toBe(',')
    expect(detectDelimiter('a;b;c\n1,2,3')).toBe(';')
    expect(detectDelimiter('"a,b";c')).toBe(';')
    expect(detectDelimiter('a\tb')).toBe('\t')
    expect(detectDelimiter('single')).toBe(',')
    expect(detectDelimiter('﻿a;b')).toBe(';')
  })
})

describe('toCSV', () => {
  it('quotes only when needed and ends every line with CRLF', () => {
    expect(toCSV([['a', 'b'], ['1', '2']])).toBe('a,b\r\n1,2\r\n')
    expect(toCSV([['x,y', 'say "hi"', 'two\nlines', ' pad', 'semi;colon', 'plain']])).toBe(
      '"x,y","say ""hi""","two\nlines"," pad","semi;colon",plain\r\n',
    )
  })

  it('writes numbers, booleans and empty values', () => {
    expect(toCSV([[1, 2.5, true, null, undefined, '']])).toBe('1,2.5,true,,,\r\n')
    expect(toCSV([])).toBe('')
  })

  it('supports a BOM and other delimiters', () => {
    expect(toCSV([['α', 'β']], { bom: true, delimiter: ';' })).toBe('﻿α;β\r\n')
  })

  it('round-trips awkward content with every delimiter', () => {
    const rows = [
      ['week', 'note', 'empty'],
      ['1', 'Line 1\nLine 2, with "quotes"; and semicolons', ''],
      ['2', '  leading and trailing  ', 'Ελληνικά'],
      ['3', '"', ','],
    ]
    for (const delimiter of [',', ';', '\t'] as const) expect(parseCSV(toCSV(rows, { delimiter, bom: true }))).toEqual(rows)
  })

  it('round-trips a single column whose cells contain other delimiter candidates', () => {
    const rows = [['a;b'], ['c,d']]
    expect(parseCSV(toCSV(rows))).toEqual(rows)
  })
})

describe('header helpers', () => {
  it('normalizeHeader', () => {
    expect(normalizeHeader('  Warm-up Sets ')).toBe('warm_up_sets')
    expect(normalizeHeader('﻿Week')).toBe('week')
  })

  it('headerIndex finds columns case-insensitively, with aliases, first match wins', () => {
    const idx = headerIndex(['Week', 'DAY', 'Sets', 'week', 'Other'], ['week', 'day', 'working_sets', 'reps'] as const, { sets: 'working_sets' })
    expect(idx).toEqual({ week: 0, day: 1, working_sets: 2 })
  })

  it('isBlankRow', () => {
    expect(isBlankRow([''])).toBe(true)
    expect(isBlankRow([' ', '\t'])).toBe(true)
    expect(isBlankRow(['', 'x'])).toBe(false)
  })
})
