import { useEffect, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

type GoogleStatus = 'idle' | 'loading' | 'ready' | 'error'

let loaderPromise: Promise<void> | null = null

function loadPlacesLibrary(key: string): Promise<void> {
  if (loaderPromise) return loaderPromise

  setOptions({ key, v: 'weekly' })

  loaderPromise = importLibrary('places')
    .then(() => {})
    .catch((err: unknown) => {
      loaderPromise = null  // allow retry on next mount
      throw err
    })

  return loaderPromise
}

export function useGooglePlaces() {
  const [status, setStatus] = useState<GoogleStatus>('idle')

  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_PLACES_KEY
    if (!key) { setStatus('error'); return }

    let cancelled = false
    setStatus('loading')
    loadPlacesLibrary(key)
      .then(() => { if (!cancelled) setStatus('ready') })
      .catch(() => { if (!cancelled) setStatus('error') })

    return () => { cancelled = true }
  }, [])

  return {
    ready:   status === 'ready',
    loading: status === 'loading',
    error:   status === 'error',
  }
}
