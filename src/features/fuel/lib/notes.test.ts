import { describe, expect, it } from 'vitest'
import { parseNotes } from './notes'

describe('parseNotes', () => {
  it('returns nothing for empty input', () => {
    expect(parseNotes('')).toEqual([])
    expect(parseNotes(null)).toEqual([])
    expect(parseNotes('\n \n')).toEqual([])
  })

  it('parses headings, bullets and paragraphs', () => {
    const src = ['# Targets', '- 2,400 kcal', '- 3 L water', '', 'Eat slowly.', 'Chew well.', '', '## Rules', '* No soda'].join('\n')
    expect(parseNotes(src)).toEqual([
      { kind: 'heading', text: 'Targets' },
      { kind: 'list', items: ['2,400 kcal', '3 L water'] },
      { kind: 'para', lines: ['Eat slowly.', 'Chew well.'] },
      { kind: 'heading', text: 'Rules' },
      { kind: 'list', items: ['No soda'] },
    ])
  })

  it('splits a paragraph from a following list and vice versa', () => {
    expect(parseNotes('Intro\n- a\n- b\nOutro')).toEqual([
      { kind: 'para', lines: ['Intro'] },
      { kind: 'list', items: ['a', 'b'] },
      { kind: 'para', lines: ['Outro'] },
    ])
  })

  it('keeps text that only looks like markup', () => {
    expect(parseNotes('#hashtag\n-5 kg\n1-2 meals')).toEqual([{ kind: 'para', lines: ['#hashtag', '-5 kg', '1-2 meals'] }])
  })

  it('handles CRLF and drops empty bullets and headings', () => {
    expect(parseNotes('# \r\n- \r\n- x\r\n')).toEqual([{ kind: 'list', items: ['x'] }])
  })
})
