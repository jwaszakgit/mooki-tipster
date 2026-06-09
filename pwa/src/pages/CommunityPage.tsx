import { useEffect, useState } from 'react'
import { RatingPips } from '../components/RatingPips'
import styles from './CommunityPage.module.css'

// ── Types ────────────────────────────────────────────────────────────────────

type SortBy = 'lastRatingDate' | 'restaurantName' | 'avgServiceRating' | 'avgSupplementalRating'
type Order  = 'asc' | 'desc'

interface ServiceBreakdown {
  friendly_engaging: number | null
  order_accuracy:    number | null
  pace:              number | null
  bill_processing:   number | null
}

interface SpreadBreakdown {
  foodQuality:  number | null
  foodValue:    number | null
  drinkQuality: number | null
  drinkValue:   number | null
  vibe:         number | null
}

interface RestaurantSummary {
  googlePlaceId:         string
  restaurantName:        string
  address1:              string
  city:                  string
  region:                string
  avgServiceRating:      number | null
  avgSupplementalRating: number | null
  lastRatingDate:        string | null
  visitCount:            number
  serviceBreakdown:      ServiceBreakdown
  spreadBreakdown:       SpreadBreakdown
}

interface SearchResponse {
  restaurants: RestaurantSummary[]
  total:       number
  offset:      number
  noResults:   boolean
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'lastRatingDate',        label: 'Last Rated On' },
  { value: 'restaurantName',        label: 'Restaurant'    },
  { value: 'avgServiceRating',      label: 'Service'       },
  { value: 'avgSupplementalRating', label: 'The Spread'    },
]

const SERVICE_ITEMS: { key: keyof ServiceBreakdown; label: string }[] = [
  { key: 'friendly_engaging', label: 'Friendly & Engaging' },
  { key: 'order_accuracy',    label: 'Ordering'            },
  { key: 'pace',              label: 'Pace'                },
  { key: 'bill_processing',   label: 'Billing'             },
]

const SPREAD_ITEMS: { key: keyof SpreadBreakdown; label: string }[] = [
  { key: 'foodQuality',  label: 'Food quality'  },
  { key: 'foodValue',    label: 'Food value'    },
  { key: 'drinkQuality', label: 'Drink quality' },
  { key: 'drinkValue',   label: 'Drink value'   },
  { key: 'vibe',         label: 'Vibe'          },
]

const LIMIT = 20

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Component ────────────────────────────────────────────────────────────────

export function CommunityPage() {
  const [inputQ,      setInputQ]      = useState('')
  const [committedQ,  setCommittedQ]  = useState('')
  const [sortBy,      setSortBy]      = useState<SortBy>('avgServiceRating')
  const [order,       setOrder]       = useState<Order>('desc')
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([])
  const [total,       setTotal]       = useState(0)
  const [offset,      setOffset]      = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [noResults,   setNoResults]   = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined

  // Load all restaurants on mount (same behaviour as before pagination was added)
  useEffect(() => {
    setHasSearched(true)
    fetchPage('', 'avgServiceRating', 'desc', 0, false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPage(
    q: string, sb: SortBy, ord: Order, fetchOffset: number, append: boolean,
  ) {
    if (!apiUrl) { setError('API URL not configured'); return }

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError(null)
      setNoResults(false)
    }

    try {
      const params = new URLSearchParams({
        q, sortBy: sb, order: ord,
        limit: String(LIMIT), offset: String(fetchOffset),
      })
      const res = await fetch(`${apiUrl}/api/v1/tipster/restaurants/search?${params}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data: SearchResponse = await res.json()

      if (append) {
        setRestaurants(prev => [...prev, ...data.restaurants])
      } else {
        setRestaurants(data.restaurants)
        setNoResults(data.noResults)
      }
      setTotal(data.total)
      setOffset(fetchOffset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      if (append) setLoadingMore(false)
      else        setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setCommittedQ(inputQ)
    setHasSearched(true)
    fetchPage(inputQ, sortBy, order, 0, false)
  }

  function handleSortBy(newSortBy: SortBy) {
    setSortBy(newSortBy)
    if (hasSearched) fetchPage(committedQ, newSortBy, order, 0, false)
  }

  function handleOrder() {
    const newOrder: Order = order === 'asc' ? 'desc' : 'asc'
    setOrder(newOrder)
    if (hasSearched) fetchPage(committedQ, sortBy, newOrder, 0, false)
  }

  function handleLoadMore() {
    fetchPage(committedQ, sortBy, order, restaurants.length, true)
  }

  const showLoadMore = hasSearched && !loading && total > offset + restaurants.length

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Community</h1>
      </header>

      <div className={styles.scroll}>

        {/* Search form */}
        <form className={styles.filterBar} onSubmit={handleSearch}>
          <input
            className={styles.filterInput}
            type="search"
            placeholder="Search by name or city…"
            value={inputQ}
            onChange={e => setInputQ(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className={styles.searchBtn} disabled={loading}>
            Search
          </button>
        </form>

        {/* Sort controls */}
        <div className={styles.sortRow}>
          <div className={styles.sortChips}>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.sortChip} ${sortBy === opt.value ? styles.sortChipActive : ''}`}
                onClick={() => handleSortBy(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.orderBtn}
            onClick={handleOrder}
            aria-label={order === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            {order === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {loading && <p className={styles.stateMsg}>Loading…</p>}
        {error   && <p className={styles.errorMsg}>{error}</p>}

        {hasSearched && !loading && !error && noResults && (
          <p className={styles.stateMsg}>No community data yet — share a visit to be the first!</p>
        )}

        {/* Result cards */}
        {restaurants.map(r => (
          <div key={r.googlePlaceId} className={styles.card}>
            <div className={styles.cardTop}>
              <p className={styles.restaurantName}>{r.restaurantName}</p>
              <p className={styles.restaurantAddr}>
                {[r.address1, r.city].filter(Boolean).join(', ')}
              </p>
            </div>

            <div className={styles.cardStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Last Rated On</span>
                <span className={styles.statValue}>{formatDate(r.lastRatingDate)}</span>
              </div>
            </div>

            {(r.avgServiceRating != null || r.avgSupplementalRating != null) && (
              <div className={styles.cardRatings}>
                {r.avgServiceRating != null && (
                  <>
                    <div className={styles.ratingRow}>
                      <span className={styles.ratingLabel}>Service</span>
                      <RatingPips value={r.avgServiceRating} />
                      <span className={styles.ratingNum}>{r.avgServiceRating.toFixed(1)}</span>
                    </div>
                    {SERVICE_ITEMS.map(item => {
                      const val = r.serviceBreakdown[item.key]
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
                {r.avgSupplementalRating != null && (
                  <>
                    <div className={styles.ratingRow}>
                      <span className={styles.ratingLabel}>The Spread</span>
                      <RatingPips value={r.avgSupplementalRating} />
                      <span className={styles.ratingNum}>{r.avgSupplementalRating.toFixed(1)}</span>
                    </div>
                    {SPREAD_ITEMS.map(item => {
                      const val = r.spreadBreakdown[item.key]
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
            )}
          </div>
        ))}

        {/* Load More */}
        {showLoadMore && (
          <div className={styles.loadMoreWrap}>
            <button
              type="button"
              className={styles.loadMoreBtn}
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}

        <div className={styles.bottomPad} />
      </div>
    </div>
  )
}
