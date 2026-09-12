import { describe, it, expect } from 'vitest'
import { parseCsv, mapRowsToTransactions } from '../csvImport'

describe('parseCsv', () => {
  it('parses a simple CSV into row objects keyed by header', () => {
    const text = 'Ticker,Type,Quantity,Price,Date\nAAPL,Buy,10,150,2025-01-01'
    expect(parseCsv(text)).toEqual([{ Ticker: 'AAPL', Type: 'Buy', Quantity: '10', Price: '150', Date: '2025-01-01' }])
  })

  it('handles quoted fields containing commas', () => {
    const text = 'Ticker,Notes\nAAPL,"Bought after earnings, on a dip"'
    expect(parseCsv(text)).toEqual([{ Ticker: 'AAPL', Notes: 'Bought after earnings, on a dip' }])
  })

  it('handles escaped double quotes within a quoted field', () => {
    const text = 'Ticker,Notes\nAAPL,"He said ""buy now"""'
    expect(parseCsv(text)).toEqual([{ Ticker: 'AAPL', Notes: 'He said "buy now"' }])
  })

  it('handles CRLF line endings', () => {
    const text = 'Ticker,Type\r\nAAPL,Buy\r\nMSFT,Sell'
    expect(parseCsv(text)).toEqual([
      { Ticker: 'AAPL', Type: 'Buy' },
      { Ticker: 'MSFT', Type: 'Sell' },
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('mapRowsToTransactions', () => {
  it('maps Athena-native headers directly', () => {
    const { rows, parseErrors } = mapRowsToTransactions([
      { Ticker: 'AAPL', Type: 'Buy', Quantity: '10', Price: '150.50', Date: '2025-01-15' },
    ])

    expect(parseErrors).toEqual([])
    expect(rows[0]).toMatchObject({ ticker: 'AAPL', type: 'BUY', quantity: 10, price: 150.5, transactionDate: '2025-01-15', valid: true })
  })

  it('recognizes common brokerage header aliases', () => {
    const { rows } = mapRowsToTransactions([
      { Symbol: 'MSFT', Action: 'Sold', Shares: '5', 'Execution Price': '400', 'Trade Date': '2025-02-01' },
    ])

    expect(rows[0]).toMatchObject({ ticker: 'MSFT', type: 'SELL', quantity: 5, price: 400 })
  })

  it('flags a row with an unrecognized type as invalid', () => {
    const { rows, parseErrors } = mapRowsToTransactions([
      { Ticker: 'AAPL', Type: 'Dividend', Quantity: '10', Price: '150', Date: '2025-01-01' },
    ])

    expect(rows[0].valid).toBe(false)
    expect(parseErrors).toHaveLength(1)
    expect(parseErrors[0].message).toContain('type must be Buy or Sell')
  })

  it('flags a row with a non-numeric quantity or price', () => {
    const { rows } = mapRowsToTransactions([
      { Ticker: 'AAPL', Type: 'Buy', Quantity: 'ten', Price: '150', Date: '2025-01-01' },
    ])

    expect(rows[0].valid).toBe(false)
  })

  it('flags a row with an unparseable date', () => {
    const { rows } = mapRowsToTransactions([{ Ticker: 'AAPL', Type: 'Buy', Quantity: '10', Price: '150', Date: 'not-a-date' }])

    expect(rows[0].valid).toBe(false)
  })

  it('flags a row missing a ticker', () => {
    const { rows } = mapRowsToTransactions([{ Type: 'Buy', Quantity: '10', Price: '150', Date: '2025-01-01' }])

    expect(rows[0].valid).toBe(false)
  })

  it('processes multiple rows independently', () => {
    const { rows, parseErrors } = mapRowsToTransactions([
      { Ticker: 'AAPL', Type: 'Buy', Quantity: '10', Price: '150', Date: '2025-01-01' },
      { Ticker: 'ZZZZ', Type: 'Bogus', Quantity: '1', Price: '1', Date: '2025-01-01' },
    ])

    expect(rows[0].valid).toBe(true)
    expect(rows[1].valid).toBe(false)
    expect(parseErrors).toHaveLength(1)
  })
})
