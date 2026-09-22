import { describe, expect, it } from 'vitest'
import { cleanHandleInput, isValidHandle, toHandle, transliterate, uniqueHandle } from './handle'

describe('transliterate', () => {
  it('turns Greek names into readable Latin', () => {
    expect(transliterate('Στέλιος')).toBe('stelios')
    expect(transliterate('Θάνος')).toBe('thanos')
    expect(transliterate('Χρήστος')).toBe('christos')
    expect(transliterate('Γιώργος')).toBe('giorgos')
    expect(transliterate('Ψαράς')).toBe('psaras')
    expect(transliterate('Αλέξανδρος')).toBe('alexandros')
    expect(transliterate('Ηλίας')).toBe('ilias')
  })
  it('handles digraphs', () => {
    expect(transliterate('Κούλης')).toBe('koulis')
    expect(transliterate('Ευάγγελος')).toBe('evangelos')
    expect(transliterate('Παύλος')).toBe('pavlos')
    expect(transliterate('Ευτυχία')).toBe('eftychia')
    expect(transliterate('Μπάμπης')).toBe('bampis')
    expect(transliterate('Ντίνος')).toBe('dinos')
    expect(transliterate('Άγγελος Παπαδόπουλος')).toBe('angelos papadopoulos')
  })
  it('leaves Latin text alone (minus accents) and lowercases', () => {
    expect(transliterate('Dennis')).toBe('dennis')
    expect(transliterate('José')).toBe('jose')
  })
})

describe('toHandle', () => {
  it('derives url-safe handles', () => {
    expect(toHandle('Στέλιος')).toBe('stelios')
    expect(toHandle('  Dennis!! ')).toBe('dennis')
    expect(toHandle('Θάνος Κ.')).toBe('thanos-k')
    expect(toHandle('Mary-Jane  O’Neil')).toBe('mary-jane-o-neil')
    expect(toHandle('!!!')).toBe('')
  })
  it('caps the length without a trailing dash', () => {
    const h = toHandle('Κωνσταντίνος Παπαγεωργίου Αλεξόπουλος')
    expect(h.length).toBeLessThanOrEqual(24)
    expect(h.endsWith('-')).toBe(false)
    expect(isValidHandle(h)).toBe(true)
  })
})

describe('isValidHandle / cleanHandleInput', () => {
  it('accepts a-z0-9 with single inner dashes', () => {
    expect(isValidHandle('stelios')).toBe(true)
    expect(isValidHandle('thanos-2')).toBe(true)
    expect(isValidHandle('a')).toBe(false)
    expect(isValidHandle('-x')).toBe(false)
    expect(isValidHandle('x--y')).toBe(false)
    expect(isValidHandle('Stelios')).toBe(false)
  })
  it('cleans typed input but keeps a trailing dash while typing', () => {
    expect(cleanHandleInput('Νίκος ')).toBe('nikos-')
    expect(cleanHandleInput('A  B__c')).toBe('a-b-c')
    expect(cleanHandleInput('--x')).toBe('x')
  })
})

describe('uniqueHandle', () => {
  it('appends a counter when taken', () => {
    expect(uniqueHandle('nikos', [])).toBe('nikos')
    expect(uniqueHandle('nikos', ['nikos'])).toBe('nikos-2')
    expect(uniqueHandle('nikos', ['nikos', 'nikos-2'])).toBe('nikos-3')
    expect(uniqueHandle('', [])).toBe('member')
  })
  it('stays within the length limit', () => {
    const base = 'a'.repeat(24)
    const h = uniqueHandle(base, [base])
    expect(h.length).toBe(24)
    expect(h.endsWith('-2')).toBe(true)
  })
})
