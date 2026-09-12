/**
 * RFC 4180 CSV reader - mirrors csvExport.js's hand-rolled, no-dependency
 * writer in reverse. Handles quoted fields, embedded commas, and escaped
 * ("") quotes within a quoted field.
 * @param {string} text
 * @returns {object[]} one plain object per data row, keyed by header
 */
export const parseCsv = (text) => {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      pushField()
    } else if (char === '\n') {
      pushRow()
    } else if (char === '\r') {
      // skip - \r\n line endings are handled by the following \n
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    pushRow()
  }

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ''))
  if (nonEmptyRows.length === 0) return []

  const [headerRow, ...dataRows] = nonEmptyRows
  const headers = headerRow.map((h) => h.trim())

  return dataRows.map((values) =>
    headers.reduce((obj, header, index) => {
      obj[header] = (values[index] ?? '').trim()
      return obj
    }, {})
  )
}

const TICKER_ALIASES = ['ticker', 'symbol']
const TYPE_ALIASES = ['type', 'action', 'side']
const QUANTITY_ALIASES = ['quantity', 'shares', 'qty']
const PRICE_ALIASES = ['price', 'execution price', 'fill price']
const DATE_ALIASES = ['date', 'trade date', 'transaction date']

const BUY_VALUES = new Set(['buy', 'bought', 'b'])
const SELL_VALUES = new Set(['sell', 'sold', 's'])

const findValue = (row, aliases) => {
  const normalizedKeys = Object.keys(row).reduce((map, key) => {
    map[key.trim().toLowerCase()] = row[key]
    return map
  }, {})
  for (const alias of aliases) {
    if (normalizedKeys[alias] !== undefined && normalizedKeys[alias] !== '') {
      return normalizedKeys[alias]
    }
  }
  return undefined
}

const normalizeType = (raw) => {
  const lower = (raw || '').trim().toLowerCase()
  if (BUY_VALUES.has(lower)) return 'BUY'
  if (SELL_VALUES.has(lower)) return 'SELL'
  return null
}

const normalizeDate = (raw) => {
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

/**
 * Tolerant header-aliasing so a CSV exported from any brokerage (not just
 * Athena's own shape) has a reasonable chance of mapping cleanly - no
 * drag-and-drop column mapper, just a fixed alias dictionary.
 * @param {object[]} rawRows - from parseCsv
 * @returns {{rows: object[], parseErrors: {row: number, message: string}[]}}
 */
export const mapRowsToTransactions = (rawRows) => {
  const rows = []
  const parseErrors = []

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 1
    const ticker = findValue(raw, TICKER_ALIASES)
    const type = normalizeType(findValue(raw, TYPE_ALIASES))
    const quantityRaw = findValue(raw, QUANTITY_ALIASES)
    const priceRaw = findValue(raw, PRICE_ALIASES)
    const transactionDate = normalizeDate(findValue(raw, DATE_ALIASES))
    const quantity = Number(quantityRaw)
    const price = Number(priceRaw)

    const rowErrors = []
    if (!ticker) rowErrors.push('missing ticker/symbol')
    if (!type) rowErrors.push('type must be Buy or Sell')
    if (!Number.isFinite(quantity) || quantity <= 0) rowErrors.push('quantity must be a positive number')
    if (!Number.isFinite(price) || price < 0) rowErrors.push('price must be zero or a positive number')
    if (!transactionDate) rowErrors.push('date could not be parsed')

    if (rowErrors.length > 0) {
      parseErrors.push({ row: rowNumber, message: rowErrors.join('; ') })
      rows.push({ row: rowNumber, ticker: ticker || '', type, quantity: quantityRaw, price: priceRaw, transactionDate, valid: false })
      return
    }

    rows.push({ row: rowNumber, ticker: ticker.toUpperCase(), type, quantity, price, transactionDate, valid: true })
  })

  return { rows, parseErrors }
}
