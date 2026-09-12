import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchJson } from '../../lib/api'

const SEARCH_DEBOUNCE_MS = 250

/**
 * A ticker text input augmented with a company-name search dropdown (backed
 * by /api/company/search, same endpoint the sidebar's ticker search uses)
 * and a resolve-on-blur fallback (/api/company/resolve) for free text that
 * isn't itself a valid ticker - e.g. typing "Indian Oil" resolves to its
 * actual ticker on blur. Stays a plain controlled text input otherwise:
 * every keystroke still calls onChange(rawText).
 */
function TickerAutocomplete({ id, value, onChange, placeholder = 'Ticker or company name', ariaLabel, className }) {
  const [suggestions, setSuggestions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isResolving, setIsResolving] = useState(false)
  const containerRef = useRef(null)
  const lastResolvedRef = useRef('')

  useEffect(() => {
    const query = value.trim()
    if (!query) {
      setSuggestions([])
      return undefined
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const data = await fetchJson(`/api/company/search?q=${encodeURIComponent(query)}`, undefined, controller.signal)
        setSuggestions(data.companies || [])
        setIsOpen(true)
        setHighlightedIndex(-1)
      } catch (searchError) {
        if (searchError.name !== 'AbortError') setSuggestions([])
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectCompany = (company) => {
    lastResolvedRef.current = company.ticker
    onChange(company.ticker)
    setSuggestions([])
    setIsOpen(false)
  }

  /** Runs on blur - lets a company name typed without picking a dropdown suggestion (or a ticker that just needs casing/exchange-suffix normalization) resolve the same way the sidebar's Enter-to-search does. */
  const resolveFreeText = async () => {
    const query = value.trim()
    if (!query || query === lastResolvedRef.current) return

    setIsResolving(true)
    try {
      const data = await fetchJson(`/api/company/resolve?q=${encodeURIComponent(query)}`)
      if (data?.ticker) {
        lastResolvedRef.current = data.ticker
        onChange(data.ticker)
      }
    } catch {
      // Leave the typed text as-is - the surrounding form's own validation
      // (e.g. "must be a valid ticker symbol") still catches it on submit.
    } finally {
      setIsResolving(false)
    }
  }

  const handleKeyDown = (event) => {
    if (isOpen && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightedIndex((index) => (index + 1) % suggestions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightedIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
        return
      }
      if (event.key === 'Escape') {
        setIsOpen(false)
        setHighlightedIndex(-1)
        return
      }
    }

    if (event.key === 'Enter' && isOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      event.preventDefault()
      selectCompany(suggestions[highlightedIndex])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true)
        }}
        onBlur={resolveFreeText}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        autoComplete="off"
        className={className}
      />
      {isResolving && (
        <Loader2
          className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-ink-muted"
          aria-hidden="true"
        />
      )}
      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-10 mt-1 max-h-56 w-max min-w-full overflow-y-auto rounded-lg border border-border bg-surface-raised py-1 shadow-lg"
        >
          {suggestions.map((company, index) => (
            <li key={company.ticker} role="option" aria-selected={index === highlightedIndex}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectCompany(company)}
                className={`flex w-full items-center justify-between gap-3 whitespace-nowrap px-3 py-1.5 text-left text-sm transition-colors ${
                  index === highlightedIndex ? 'bg-surface-sunken text-ink' : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'
                }`}
              >
                <span className="min-w-0 truncate">{company.name}</span>
                <span className="ml-2 shrink-0 text-xs font-semibold text-brand-500">{company.ticker}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default TickerAutocomplete
