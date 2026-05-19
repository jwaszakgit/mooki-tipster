import { useEffect, useState } from 'react'

type GoogleStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useGooglePlaces() {
  const [status, setStatus] = useState<GoogleStatus>('idle')

  useEffect(() => {
    if ((window as any).google?.maps?.places) {
      setStatus('ready')
      return
    }

    const key = import.meta.env.VITE_GOOGLE_PLACES_KEY
    if (!key) {
      setStatus('error')
      return
    }

    // Script already injected by a previous mount — attach to its events
    const existing = document.getElementById('gmp-script') as HTMLScriptElement | null
    if (existing) {
      setStatus('loading')
      const onLoad  = () => setStatus('ready')
      const onError = () => setStatus('error')
      existing.addEventListener('load', onLoad)
      existing.addEventListener('error', onError)
      return () => {
        existing.removeEventListener('load', onLoad)
        existing.removeEventListener('error', onError)
      }
    }

    setStatus('loading')
    const script = document.createElement('script')
    script.id    = 'gmp-script'
    script.src   = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true
    script.defer = true
    script.onload  = () => setStatus('ready')
    script.onerror = () => setStatus('error')
    document.head.appendChild(script)
  }, [])

  return {
    ready:   status === 'ready',
    loading: status === 'loading',
    error:   status === 'error',
  }
}
