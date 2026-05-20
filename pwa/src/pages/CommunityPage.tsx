import { useEffect, useMemo, useState } from 'react'
import { RatingPips } from '../components/RatingPips'
import styles from './CommunityPage.module.css'

// ── Types ────────────────────────────────────────────────────────────────────

type SortBy = 'lastVisitAt' | 'restaurantName' | 'avgServiceRating' | 'avgSupplementalRating'
type Order  = 'asc' | 'desc'

interface CommunityRatings {
  avgServiceRating:      number | null
  avgSupplementalRating: number | null
  visitCount:            number
  tipPctFinal:           number | null
  lastVisitAt:           string | null
  serviceBreakdown?: {
    friendly_engaging: number | null
    order_accuracy:    number | null
    pace:              number | null
    bill_processing:   number | null
  }
  spreadBreakdown?: {
    foodQuality:  number | null
    foodValue:    number | null
    drinkQuality: number | null
    drinkValue:   number | null
    vibe:         number | null
  }
}

interface RestaurantResult {
  id:       string
  name:     string
  address1: string
  city:     string
  region:   string
  community: CommunityRatings
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'lastVisitAt',           label: 'Last Visit'  },
  { value: 'restaurantName',        label: 'Restaurant'  },
  { value: 'avgServiceRating',      label: 'Service'     },
  { value: 'avgSupplementalRating', label: 'The Spread'  },
]

const SERVICE_ITEMS = [
  { key: 'friendly_engaging' as const, label: 'Friendly & Engaging' },
  { key: 'order_accuracy'    as const, label: 'Ordering'            },
  { key: 'pace'              as const, label: 'Pace'                },
  { key: 'bill_processing'   as const, label: 'Billing'             },
]

const SPREAD_ITEMS = [
  { key: 'foodQuality'  as const, label: 'Food quality'  },
  { key: 'foodValue'    as const, label: 'Food value'    },
  { key: 'drinkQuality' as const, label: 'Drink quality' },
  { key: 'drinkValue'   as const, label: 'Drink value'   },
  { key: 'vibe'         as const, label: 'Vibe'          },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Component ────────────────────────────────────────────────────────────────

export function CommunityPage() {
  const [results,    setResults]    = useState<RestaurantResult[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [nameFilter, setNameFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [sortBy,     setSortBy]     = useState<SortBy>('lastVisitAt')
  const [order,      setOrder]      = useState<Order>('desc')

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) { setError('API URL not configured'); setLoading(false); return }

    fetch(`${apiUrl}/api/v1/tipster/restaurants/search`)
      .then(res => {
        if (!res.ok) throw new Error(`Error ${res.status}`)
        return res.json() as Promise<{ results: RestaurantResult[]; noResults: boolean }>
      })
      .then(data => setResults(data.results ?? []))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const cities = useMemo(() =>
    [...new Set(results.map(r => r.city).filter(Boolean))].sort()
  , [results])

  const filtered = useMemo(() =>
    results.filter(r => {
      const nameOk = !nameFilter || r.name.toLowerCase().includes(nameFilter.toLowerCase())
      const cityOk = !cityFilter || r.city === cityFilter
      return nameOk && cityOk
    })
  , [results, nameFilter, cityFilter])

  const sorted = useMemo(() => {
    const dir = order === 'asc' ? 1 : -1
    const nullLast = (v: number | null) =>
      v != null ? v : order === 'asc' ? Infinity : -Infinity
    const nullLastDate = (v: string | null) =>
      v != null ? new Date(v).getTime() : order === 'asc' ? Infinity : -Infinity

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'restaurantName':
          return dir * a.name.localeCompare(b.name)
        case 'avgServiceRating':
          return dir * (nullLast(a.community.avgServiceRating) - nullLast(b.community.avgServiceRating))
        case 'avgSupplementalRating':
          return dir * (nullLast(a.community.avgSupplementalRating) - nullLast(b.community.avgSupplementalRating))
        default: // lastVisitAt
          return dir * (nullLastDate(a.community.lastVisitAt) - nullLastDate(b.community.lastVisitAt))
      }
    })
  }, [filtered, sortBy, order])

  const hasData = !loading && !error

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Community</h1>
      </header>

      <div className={styles.scroll}>

        {/* Filter bar — only shown once data is loaded */}
        {hasData && results.length > 0 && (
          <div className={styles.filterBar}>
            <input
              className={styles.filterInput}
              type="search"
              placeholder="Filter by name…"
              value={nameFilter}
              onChange={e => setNameFilter(e.target.value)}
              autoComplete="off"
            />
            <select
              className={styles.citySelect}
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
            >
              <option value="">All cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {loading && <p className={styles.stateMsg}>Loading…</p>}
        {error   && <p className={styles.errorMsg}>{error}</p>}

        {hasData && results.length === 0 && (
          <p className={styles.stateMsg}>No community data yet — share a visit to be the first!</p>
        )}

        {hasData && results.length > 0 && sorted.length === 0 && (
          <p className={styles.stateMsg}>No restaurants match your filters.</p>
        )}

        {/* Sort controls */}
        {sorted.length > 0 && (
          <div className={styles.sortRow}>
            <div className={styles.sortChips}>
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.sortChip} ${sortBy === opt.value ? styles.sortChipActive : ''}`}
                  onClick={() => setSortBy(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              className={styles.orderBtn}
              onClick={() => setOrder(o => o === 'asc' ? 'desc' : 'asc')}
              aria-label={order === 'asc' ? 'Sort descending' : 'Sort ascending'}
            >
              {order === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        )}

        {/* Result cards */}
        {sorted.map(r => (
          <div key={r.id} className={styles.card}>
            <div className={styles.cardTop}>
              <p className={styles.restaurantName}>{r.name}</p>
              <p className={styles.restaurantAddr}>
                {[r.address1, r.city, r.region].filter(Boolean).join(', ')}
              </p>
            </div>

            <div className={styles.cardStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Last visit</span>
                <span className={styles.statValue}>{formatDate(r.community.lastVisitAt)}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Visits</span>
                <span className={styles.statValue}>{r.community.visitCount}</span>
              </div>
              {r.community.tipPctFinal != null && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Avg tip</span>
                  <span className={styles.statValue}>{Math.round(r.community.tipPctFinal)}%</span>
                </div>
              )}
            </div>

            <div className={styles.cardRatings}>
              {r.community.avgServiceRating != null && (
                <>
                  <div className={styles.ratingRow}>
                    <span className={styles.ratingLabel}>Service</span>
                    <RatingPips value={r.community.avgServiceRating} />
                    <span className={styles.ratingNum}>
                      {r.community.avgServiceRating.toFixed(1)}
                    </span>
                  </div>
                  {r.community.serviceBreakdown && SERVICE_ITEMS.map(item => {
                    const val = r.community.serviceBreakdown![item.key]
                    if (val == null) return null
                    return (
                      <div key={item.key} className={styles.ratingSubRow}>
                        <span className={styles.ratingSubLabel}>{item.label}</span>
                        <RatingPips value={val} size="sm" />
                        <span className={styles.ratingSubNum}>{val.toFixed(1)}</span>
                      </div>
                    )
                  })}
                </>
              )}
              {r.community.avgSupplementalRating != null && (
                <>
                  <div className={styles.ratingRow}>
                    <span className={styles.ratingLabel}>The Spread</span>
                    <RatingPips value={r.community.avgSupplementalRating} />
                    <span className={styles.ratingNum}>
                      {r.community.avgSupplementalRating.toFixed(1)}
                    </span>
                  </div>
                  {r.community.spreadBreakdown && SPREAD_ITEMS.map(item => {
                    const val = r.community.spreadBreakdown![item.key]
                    if (val == null) return null
                    return (
                      <div key={item.key} className={styles.ratingSubRow}>
                        <span className={styles.ratingSubLabel}>{item.label}</span>
                        <RatingPips value={val} size="sm" />
                        <span className={styles.ratingSubNum}>{val.toFixed(1)}</span>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        ))}

        <div className={styles.bottomPad} />
      </div>
    </div>
  )
}
