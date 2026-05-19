import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { RatingPips } from '../components/RatingPips'
import styles from './MyVisitsPage.module.css'

// ── Types ────────────────────────────────────────────────────────────────────

type SortBy = 'restaurantName' | 'visitedAt' | 'avgServiceRating' | 'avgSupplementalRating'
type Order  = 'asc' | 'desc'

interface Visit {
  id:                    string
  visitedAt:             string
  tipPctFinal:           number
  restaurant:            { name: string; address1: string; city: string; region: string } | null
  avgServiceRating:      number | null
  avgSupplementalRating: number | undefined
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'visitedAt',             label: 'Date'        },
  { value: 'restaurantName',        label: 'Restaurant'  },
  { value: 'avgServiceRating',      label: 'Service'     },
  { value: 'avgSupplementalRating', label: 'Experience'  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(iso))
}

// ── Component ────────────────────────────────────────────────────────────────

export function MyVisitsPage() {
  const { deviceId } = useAppStore()

  const [visits,  setVisits]  = useState<Visit[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [sortBy,  setSortBy]  = useState<SortBy>('visitedAt')
  const [order,   setOrder]   = useState<Order>('desc')

  useEffect(() => {
    if (!deviceId) return

    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) { setError('API URL not configured'); return }

    setLoading(true)
    setError(null)

    fetch(`${apiUrl}/api/v1/tipster/visits/${deviceId}?sortBy=${sortBy}&order=${order}`)
      .then(res => {
        if (!res.ok) throw new Error(`Error ${res.status}`)
        return res.json()
      })
      .then((data: Visit[]) => setVisits(data))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load visits'))
      .finally(() => setLoading(false))
  }, [deviceId, sortBy, order])

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

        {/* Loading */}
        {loading && <p className={styles.stateMsg}>Loading…</p>}

        {/* Error */}
        {!loading && error && <p className={styles.errorMsg}>{error}</p>}

        {/* Empty state */}
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
                <div className={styles.ratingRow}>
                  <span className={styles.ratingLabel}>Service</span>
                  <RatingPips value={visit.avgServiceRating} />
                  <span className={styles.ratingNum}>
                    {visit.avgServiceRating.toFixed(1)}
                  </span>
                </div>
              )}
              {visit.avgSupplementalRating != null && (
                <div className={styles.ratingRow}>
                  <span className={styles.ratingLabel}>Experience</span>
                  <RatingPips value={visit.avgSupplementalRating} />
                  <span className={styles.ratingNum}>
                    {visit.avgSupplementalRating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        <div className={styles.bottomPad} />
      </div>
    </div>
  )
}
