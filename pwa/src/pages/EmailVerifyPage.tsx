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
        // Signal other tabs (same browser) that verification is done
        localStorage.setItem('mooki_tipster_email_verified', Date.now().toString())
        window.history.replaceState({}, '', '/')

        // Submit pending visit if one was saved before verification
        const snapshot = pendingVisit
        if (snapshot) {
          try {
            const visitRes = await fetch(`${apiUrl}/api/v1/tipster/visits`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify(snapshot),
            })
            setPendingVisit(null)
            resetHomeForm()
            if (visitRes.ok) {
              setLastVisitLocation(snapshot.lat, snapshot.lng)
              setMessage('Email verified — your rating has been saved!')
            } else {
              setMessage('Email verified! Your pending rating could not be saved — please re-submit it.')
            }
          } catch {
            setPendingVisit(null)
            resetHomeForm()
            setMessage('Email verified! Your pending rating could not be saved — please re-submit it.')
          }
        } else {
          setMessage('Email verified!')
        }

        setStatus('success')
        setTimeout(() => setPage('home'), 2500)
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
            <p className={styles.text}>{message}</p>
            <p className={styles.sub}>Taking you back…</p>
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
