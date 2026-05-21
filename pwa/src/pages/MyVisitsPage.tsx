import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { RatingPips } from '../components/RatingPips'
import styles from './MyVisitsPage.module.css'

// ── Types ────────────────────────────────────────────────────────────────────

type SortBy = 'restaurantName' | 'visitedAt' | 'avgServiceRating' | 'avgSupplementalRating'
type Order  = 'asc' | 'desc'

interface VariableRating {
  defaultMatchKey: string | null
  likertValue:     number
}

interface SupplementalRating {
  foodQuality:  number
  foodValue:    number
  drinkQuality: number
  drinkValue:   number
  vibe:         number
}

interface Visit {
  id:                    string
  visitedAt:             string
  tipPctFinal:           number
  restaurant:            { name: string; address1: string; city: string; region: string } | null
  avgServiceRating:      number | null
  avgSupplementalRating: number | undefined
  variableRatings:       VariableRating[]
  supplementalRating:    SupplementalRating | null
}

const LIMIT = 20

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'visitedAt',             label: 'Last Visit'  },
  { value: 'restaurantName',        label: 'Restaurant'  },
  { value: 'avgServiceRating',      label: 'Service'     },
  { value: 'avgSupplementalRating', label: 'The Spread'  },
]

const SERVICE_ITEMS = [
  { key: 'friendly_engaging', label: 'Friendly & Engaging' },
  { key: 'order_accuracy',    label: 'Ordering'            },
  { key: 'pace',              label: 'Pace'                },
  { key: 'bill_processing',   label: 'Billing'             },
]

const SPREAD_ITEMS: { key: keyof SupplementalRating; label: string }[] = [
  { key: 'foodQuality',  label: 'Food quality'  },
  { key: 'foodValue',    label: 'Food value'    },
  { key: 'drinkQuality', label: 'Drink quality' },
  { key: 'drinkValue',   label: 'Drink value'   },
  { key: 'vibe',         label: 'Vibe'          },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(iso))
}

// ── Component ────────────────────────────────────────────────────────────────

export function MyVisitsPage() {
  const { deviceId } = useAppStore()

  const [visits,      setVisits]      = useState<Visit[]>([])
  const [total,       setTotal]       = useState(0)
  const [offset,      setOffset]      = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [sortBy,      setSortBy]      = useState<SortBy>('visitedAt')
  const [order,       setOrder]       = useState<Order>('desc')

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined

  useEffect(() => {
    fetchPage('visitedAt', 'desc', 0, false)
  }, [deviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPage(sb: SortBy, ord: Order, fetchOffset: number, append: boolean) {
    if (!deviceId) return
    if (!apiUrl) { setError('API URL not configured'); return }

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError(null)
    }

    try {
      const params = new URLSearchParams({
        sortBy: sb, order: ord,
        limit: String(LIMIT), offset: String(fetchOffset),
      })
      const res = await fetch(`${apiUrl}/api/v1/tipster/visits/${deviceId}?${params}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data: { visits: Visit[]; total: number; offset: number } = await res.json()

      if (append) {
        setVisits(prev => [...prev, ...data.visits])
      } else {
        setVisits(data.visits)
      }
      setTotal(data.total)
      setOffset(fetchOffset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visits')
    } finally {
      if (append) setLoadingMore(false)
      else        setLoading(false)
    }
  }

  function handleSortBy(newSortBy: SortBy) {
    setSortBy(newSortBy)
    fetchPage(newSortBy, order, 0, false)
  }

  function handleOrder() {
    const newOrder: Order = order === 'asc' ? 'desc' : 'asc'
    setOrder(newOrder)
    fetchPage(sortBy, newOrder, 0, false)
  }

  function handleLoadMore() {
    fetchPage(sortBy, order, visits.length, true)
  }

  const showLoadMore = !loading && total > offset + visits.length

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Visits</h1>
      </header>

      <div className={styles.scroll}>

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
        {!loading && error && <p className={styles.errorMsg}>{error}</p>}

        {!loading && !error && visits.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyMsg}>
              No saved visits yet — use Save &amp; Share after calculating a tip to record your first visit.
            </p>
          </div>
        )}

        {/* Visit cards */}
        {!loading && !error && visits.map(visit => (
          <div key={visit.id} className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.cardMain}>
                <p className={styles.restaurantName}>
                  {visit.restaurant?.name ?? 'Unknown restaurant'}
                </p>
                <p className={styles.restaurantAddr}>
                  {[visit.restaurant?.address1, visit.restaurant?.city]
                    .filter(Boolean).join(', ')}
                </p>
              </div>
              <div className={styles.cardMeta}>
                <p className={styles.date}>{formatDate(visit.visitedAt)}</p>
                <p className={styles.tipPct}>{Math.round(visit.tipPctFinal)}% tip</p>
              </div>
            </div>

            <div className={styles.cardRatings}>
              {visit.avgServiceRating != null && (
                <>
                  <div className={styles.ratingRow}>
                    <span className={styles.ratingLabel}>Service</span>
                    <RatingPips value={visit.avgServiceRating} />
                    <span className={styles.ratingNum}>
                      {visit.avgServiceRating.toFixed(1)}
                    </span>
                  </div>
                  {SERVICE_ITEMS.map(item => {
                    const vr = visit.variableRatings?.find(r => r.defaultMatchKey === item.key)
                    if (!vr) return null
                    return (
                      <div key={item.key} className={styles.ratingSubRow}>
                        <span className={styles.ratingSubLabel}>{item.label}</span>
                        <RatingPips value={vr.likertValue} size="sm" />
                        <span className={styles.ratingSubNum}>{vr.likertValue.toFixed(1)}</span>
                      </div>
                    )
                  })}
                </>
              )}
              {visit.avgSupplementalRating != null && (
                <>
                  <div className={styles.ratingRow}>
                    <span className={styles.ratingLabel}>The Spread</span>
                    <RatingPips value={visit.avgSupplementalRating} />
                    <span className={styles.ratingNum}>
                      {visit.avgSupplementalRating.toFixed(1)}
                    </span>
                  </div>
                  {visit.supplementalRating && SPREAD_ITEMS.map(item => {
                    const val = visit.supplementalRating![item.key]
                    if (!val || val === 0) return null
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
