import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import styles from './EmailVerifyPage.module.css'

export function EmailVerifyPage() {
  const {
    setPage,
    setRecoveryEmailVerified,
    pendingVisit,
    setPendingVisit,
    setLastVisitLocation,
    resetHomeForm,
  } = useAppStore()

  const [status,  setStatus]  = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('')
  const [hasPending, setHasPending] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')

    if (!token) {
      setStatus('error')
      setMessage('No verification token found in the link.')
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL

    async function verify() {
      try {
        const res = await fetch(
          `${apiUrl}/api/v1/tipster/email/verify?token=${encodeURIComponent(token!)}`,
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as any).error ?? `Verification failed (${res.status})`)
        }

        setRecoveryEmailVerified(true)
        // Signal other tabs in the same browser so they resync without user action
        localStorage.setItem('mooki_tipster_email_verified', Date.now().toString())
        window.history.replaceState({}, '', '/')

        // Submit pending visit only if this is the same browser that initiated
        // verification (pendingVisit will be null in a different browser context)
        const snapshot = pendingVisit
        if (snapshot) {
          setHasPending(true)
          try {
            const visitRes = await fetch(`${apiUrl}/api/v1/tipster/visits`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify(snapshot),
            })
            setPendingVisit(null)
            resetHomeForm()
            if (visitRes.ok) setLastVisitLocation(snapshot.lat, snapshot.lng)
          } catch {
            setPendingVisit(null)
            resetHomeForm()
          }
        }

        setStatus('success')
      } catch (err) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Verification failed.')
      }
    }

    verify()
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {status === 'verifying' && (
          <>
            <div className={styles.spinner} />
            <p className={styles.text}>Verifying your email…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <p className={styles.iconOk}>✓</p>
            <p className={styles.text}>
              {hasPending ? 'Email verified — your rating has been saved!' : 'Email verified.'}
            </p>
            <p className={styles.sub}>
              Return to Tipster in your original browser or app.
            </p>
            <p className={styles.sub}>You can close this tab.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className={styles.iconErr}>✕</p>
            <p className={styles.text}>{message}</p>
            <button className={styles.btn} onClick={() => { window.history.replaceState({}, '', '/'); setPage('home') }}>
              Go to Home
            </button>
          </>
        )}
      </div>
    </div>
  )
}
