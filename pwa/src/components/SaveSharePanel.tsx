import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import type { TipResult } from '../services/tipCalculator'
import { useGooglePlaces } from '../hooks/useGooglePlaces'
import styles from './SaveSharePanel.module.css'

// ── Constants ────────────────────────────────────────────────────────────────

const LIKERT_EMOJI = ['😢', '😑', '😐', '🙂', '😁'] as const

const SUPP_FIELDS = [
  { key: 'foodQuality'  as const, label: 'Food quality'  },
  { key: 'foodValue'    as const, label: 'Food value'    },
  { key: 'drinkQuality' as const, label: 'Drink quality' },
  { key: 'drinkValue'   as const, label: 'Drink value'   },
  { key: 'vibe'         as const, label: 'Vibe'          },
]

type SuppKey = typeof SUPP_FIELDS[number]['key']

// Client-side mapping from the app's default variable labels to canonical API match keys.
// Handles label text divergence between the client defaults and the server canonical names.
const LABEL_TO_MATCH_KEY: Record<string, string> = {
  'friendly and engaging':        'friendly_engaging',
  'order experience and results': 'order_accuracy',
  'pace of drinks and food':      'pace',
  'bill delivery and accuracy':   'bill_processing',
}

const DEFAULT_SUPP: Record<SuppKey, number> = {
  foodQuality: 0, foodValue: 0, drinkQuality: 0, drinkValue: 0, vibe: 0,
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PlaceData {
  googlePlaceId:  string
  restaurantName: string
  address1:       string
  address2:       string | null
  city:           string
  region:         string
  postalCode:     string
  country:        string
  lat:            number
  lng:            number
}

interface Props {
  result:         TipResult
  onSuccess:      (message: string) => void
  initialSearch?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parsePlaceResult(place: any): PlaceData | null {
  if (!place.address_components || !place.geometry?.location) return null

  const get = (type: string, nameType: 'short_name' | 'long_name' = 'long_name'): string => {
    const comp = (place.address_components as any[]).find((c: any) => c.types.includes(type))
    return comp?.[nameType] ?? ''
  }

  const streetNumber = get('street_number')
  const route        = get('route')
  const address1     = [streetNumber, route].filter(Boolean).join(' ')
  const subpremise   = get('subpremise')

  return {
    googlePlaceId:  place.place_id  ?? '',
    restaurantName: place.name      ?? '',
    address1:       address1 || '',
    address2:       subpremise || null,
    city:           get('locality'),
    region:         get('administrative_area_level_1', 'short_name'),
    postalCode:     get('postal_code'),
    country:        get('country'),
    lat:            place.geometry.location.lat(),
    lng:            place.geometry.location.lng(),
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function SaveSharePanel({ result, onSuccess, initialSearch }: Props) {
  const { deviceId, settings, likertRatings, splitBy, billText } = useAppStore()
  const { ready: googleReady, error: googleError } = useGooglePlaces()

  const [placeData,   setPlaceData]   = useState<PlaceData | null>(null)
  const [placeError,  setPlaceError]  = useState<string | null>(null)
  const [suppRatings, setSuppRatings] = useState<Record<SuppKey, number>>({ ...DEFAULT_SUPP })
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const inputRef        = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)

  useEffect(() => {
    if (!googleReady || !inputRef.current) return

    const g  = (window as any).google
    const el = inputRef.current

    const ac = new g.maps.places.Autocomplete(el, {
      types:  ['establishment'],
      fields: ['place_id', 'name', 'address_components', 'geometry'],
    })

    // Pre-populate from Community "Be the first to rate" flow
    if (initialSearch) el.value = initialSearch

    ac.addListener('place_changed', () => {
      const parsed = parsePlaceResult(ac.getPlace())
      if (parsed) {
        setPlaceData(parsed)
        setPlaceError(null)
      } else {
        setPlaceData(null)
        setPlaceError('Could not retrieve address details — please try a different selection.')
      }
    })

    // Clear confirmed place whenever the user edits the input manually
    const handleInput = () => {
      setPlaceData(null)
      setPlaceError(null)
    }
    el.addEventListener('input', handleInput)

    autocompleteRef.current = ac

    return () => {
      if (autocompleteRef.current) g.maps.event.clearInstanceListeners(autocompleteRef.current)
      el.removeEventListener('input', handleInput)
    }
  }, [googleReady])

  const bill = billText ? parseInt(billText) / 100 : 0

  async function handleSubmit() {
    if (!placeData || !deviceId) return

    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) {
      setSubmitError('API URL not configured — set VITE_API_URL in .env')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const variableRatings = settings.variables.map((v, i) => ({
        labelAtTime:     v.label || `Variable ${v.sortOrder + 1}`,
        defaultMatchKey: LABEL_TO_MATCH_KEY[v.label.toLowerCase().trim()] ?? null,
        likertValue:     likertRatings[v.id] ?? 3,
        pctContribution: result.perVariableContribution[i]?.pctContribution ?? 0,
      }))

      const hasAnySuppRating = Object.values(suppRatings).some(v => v > 0)

      const payload = {
        deviceId,
        ...placeData,
        billAmount:     bill,
        currency:       settings.currency,
        splitBy,
        tipPctFinal:    result.tipPctFinal,
        tipAmountFinal: result.tipAmountFinal,
        variableRatings,
        ...(hasAnySuppRating ? { supplementalRating: suppRatings } : {}),
      }

      const res = await fetch(`${apiUrl}/api/v1/tipster/visits`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as any).error ?? `Server error (${res.status})`)
      }

      onSuccess('Visit saved!')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.root}>

      {/* Restaurant search */}
      <section className={styles.card}>
        <p className={styles.cardLabel}>Restaurant</p>

        {googleError ? (
          <p className={styles.apiError}>
            Places search unavailable — check VITE_GOOGLE_PLACES_KEY.
          </p>
        ) : (
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            placeholder={googleReady ? 'Search for a restaurant…' : 'Loading search…'}
            disabled={!googleReady}
          />
        )}

        {placeError && <p className={styles.placeError}>{placeError}</p>}

        {placeData && (
          <div className={styles.addressConfirm}>
            <p className={styles.addressName}>{placeData.restaurantName}</p>
            {placeData.address1 && (
              <p className={styles.addressLine}>
                {placeData.address1}{placeData.address2 ? `, ${placeData.address2}` : ''}
              </p>
            )}
            <p className={styles.addressLine}>
              {[placeData.city, placeData.region, placeData.postalCode].filter(Boolean).join(', ')}
            </p>
            {placeData.country && <p className={styles.addressLine}>{placeData.country}</p>}
          </div>
        )}
      </section>

      {/* Supplemental survey */}
      <section className={styles.card}>
        <p className={styles.cardLabel}>Your experience</p>
        <p className={styles.cardHint}>Rate what applies — leave anything that doesn't apply unrated.</p>
        <div className={styles.suppList}>
          {SUPP_FIELDS.map(({ key, label }) => (
            <div key={key} className={styles.suppItem}>
              <p className={styles.suppLabel}>{label}</p>
              <div className={styles.likertRow}>
                {LIKERT_EMOJI.map((emoji, idx) => {
                  const value    = idx + 1
                  const selected = suppRatings[key] === value
                  return (
                    <button
                      key={value}
                      className={`${styles.likertBtn} ${selected ? styles.likertSelected : ''}`}
                      onClick={() => setSuppRatings(r => ({ ...r, [key]: value }))}
                      aria-label={`${emoji} (${value} of 5)`}
                    >
                      {emoji}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Error + Submit */}
      {submitError && <p className={styles.submitError}>{submitError}</p>}
      <button
        className={`${styles.submitBtn} ${(!placeData || submitting) ? styles.submitDisabled : ''}`}
        onClick={handleSubmit}
        disabled={!placeData || submitting}
      >
        {submitting ? 'Saving…' : 'Submit'}
      </button>

    </div>
  )
}
