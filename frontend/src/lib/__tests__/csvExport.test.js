import { describe, it, expect } from 'vitest'
import { buildCsv } from '../csvExport'

describe('buildCsv', () => {
  it('returns an empty string for no rows', () => {
    expect(buildCsv([])).toBe('')
    expect(buildCsv(undefined)).toBe('')
  })

  it('builds a header row from the first row\'s keys', () => {
    const csv = buildCsv([{ Ticker: 'AAPL', Shares: 10 }])
    expect(csv).toBe('Ticker,Shares\r\nAAPL,10')
  })

  it('renders null/undefined as an empty field', () => {
    const csv = buildCsv([{ Ticker: 'AAPL', Price: null }])
    expect(csv).toBe('Ticker,Price\r\nAAPL,')
  })

  it('quotes and escapes a field containing a comma', () => {
    const csv = buildCsv([{ Name: 'Apple, Inc.' }])
    expect(csv).toBe('Name\r\n"Apple, Inc."')
  })

  it('quotes and doubles an embedded quote', () => {
    const csv = buildCsv([{ Name: 'The "Best" Co' }])
    expect(csv).toBe('Name\r\n"The ""Best"" Co"')
  })

  it('quotes a field containing a newline', () => {
    const csv = buildCsv([{ Notes: 'line one\nline two' }])
    expect(csv).toBe('Notes\r\n"line one\nline two"')
  })

  it('renders multiple rows in order', () => {
    const csv = buildCsv([
      { Ticker: 'AAPL', Shares: 10 },
      { Ticker: 'MSFT', Shares: 5 },
    ])
    expect(csv).toBe('Ticker,Shares\r\nAAPL,10\r\nMSFT,5')
  })
})
