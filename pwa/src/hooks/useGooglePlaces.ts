import { useEffect, useState } from 'react'

type GoogleStatus = 'idle' | 'loading' | 'ready' | 'error'

// Module-level singleton so multiple hook instances share one load attempt.
let libraryPromise: Promise<void> | null = null

function loadPlacesLibrary(key: string): Promise<void> {
  if (libraryPromise) return libraryPromise

  libraryPromise = new Promise<void>((resolve, reject) => {
    // Already bootstrapped (e.g. HMR remount) — just import the library.
    const g = (window as any).google
    if (g?.maps?.importLibrary) {
      g.maps.importLibrary('places').then(() => resolve()).catch(reject)
      return
    }

    const script = document.createElement('script')
    script.id    = 'gmp-script'
    // loading=async tells the Maps JS API to use its async bootstrap path,
    // which is required when using importLibrary instead of &libraries=.
    script.src   = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async`
    script.async = true
    script.defer = true
    script.onload  = () => (window as any).google.maps.importLibrary('places')
                             .then(() => resolve()).catch(reject)
    script.onerror = () => reject(new Error('Maps script failed to load'))
    document.head.appendChild(script)
  })

  return libraryPromise
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
