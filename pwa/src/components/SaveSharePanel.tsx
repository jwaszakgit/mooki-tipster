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

// Parses a Place object from the new google.maps.places.PlaceAutocompleteElement API.
// Field names changed in the new API: long_name→longText, short_name→shortText,
// place_id→id, name→displayName, geometry.location→location.
function parsePlaceResult(place: any): PlaceData | null {
  if (!place.addressComponents || !place.location) return null

  const get = (type: string, nameType: 'longText' | 'shortText' = 'longText'): string => {
    const comp = (place.addressComponents as any[]).find((c: any) => c.types.includes(type))
    return comp?.[nameType] ?? ''
  }

  const address1 = [get('street_number'), get('route')].filter(Boolean).join(' ')

  return {
    googlePlaceId:  place.id              ?? '',
    restaurantName: place.displayName     ?? '',
    address1:       address1              || '',
    address2:       get('subpremise')     || null,
    city:           get('locality'),
    region:         get('administrative_area_level_1', 'shortText'),
    postalCode:     get('postal_code'),
    country:        get('country'),
    lat:            place.location.lat(),
    lng:            place.location.lng(),
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

  // Container div that PlaceAutocompleteElement is appended into.
  const containerRef    = useRef<HTMLDivElement>(null)
  const autocompleteRef = useRef<any>(null)

  useEffect(() => {
    if (!googleReady || !containerRef.current) return

    const g         = (window as any).google
    const container = containerRef.current
    const pac       = new g.maps.places.PlaceAutocompleteElement({ types: ['establishment'] })

    // Pre-populate for the Community "Be the first to rate" flow.
    // The element's input lives in its shadow DOM; requestAnimationFrame lets
    // it render before we reach in.
    if (initialSearch) {
      requestAnimationFrame(() => {
        const inner = pac.shadowRoot?.querySelector('input')
        if (inner) {
          inner.value = initialSearch
          inner.dispatchEvent(new Event('input', { bubbles: true }))
        }
      })
    }

    const handleSelect = async (event: any) => {
      const place = event.placePrediction.toPlace()
      try {
        await place.fetchFields({ fields: ['id', 'displayName', 'addressComponents', 'location'] })
        const parsed = parsePlaceResult(place)
        if (parsed) {
          setPlaceData(parsed)
          setPlaceError(null)
        } else {
          setPlaceData(null)
          setPlaceError('Could not retrieve address details — please try a different selection.')
        }
      } catch {
        setPlaceData(null)
        setPlaceError('Could not retrieve address details — please try a different selection.')
      }
    }

    // input events from the shadow DOM's <input> are composed:true and bubble out.
    const handleInput = () => {
      setPlaceData(null)
      setPlaceError(null)
    }

    pac.addEventListener('gmp-select', handleSelect)
    pac.addEventListener('input', handleInput)
    container.appendChild(pac)
    autocompleteRef.current = pac

    return () => {
      pac.removeEventListener('gmp-select', handleSelect)
      pac.removeEventListener('input', handleInput)
      if (container.contains(pac)) container.removeChild(pac)
      autocompleteRef.current = null
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
        ) : !googleReady ? (
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Loading search…"
            disabled
          />
        ) : (
          <div ref={containerRef} className={styles.searchContainer} />
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
        <p className={styles.cardLabel}>The Spread</p>
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
