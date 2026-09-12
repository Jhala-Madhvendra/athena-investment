/** Quotes a single CSV field per RFC 4180 - wraps in quotes and escapes embedded quotes whenever the value contains a comma, quote, or newline. */
const formatCsvField = (value) => {
  const stringValue = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

/**
 * Builds CSV text from an array of plain objects - the header row is taken
 * from the first row's own keys, so callers control column order/naming by
 * shaping the objects they pass in rather than this function guessing.
 * @param {object[]} rows
 * @returns {string}
 */
export const buildCsv = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return ''

  const columns = Object.keys(rows[0])
  const headerLine = columns.map(formatCsvField).join(',')
  const dataLines = rows.map((row) => columns.map((column) => formatCsvField(row[column])).join(','))

  return [headerLine, ...dataLines].join('\r\n')
}

/**
 * Builds CSV from `rows` and triggers a browser download - no server round
 * trip, no dependency. Same "temporary anchor + Blob" pattern used for any
 * client-generated file download.
 * @param {string} filename
 * @param {object[]} rows
 */
export const downloadCsv = (filename, rows) => {
  const csv = buildCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
