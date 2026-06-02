import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import styles from './RecoverPage.module.css'

export function RecoverPage() {
  const { setPage, setDeviceId } = useAppStore()

  // Capture once at mount — replaceState later clears the URL so we can't re-read it
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'))

  // ── Token mode (deep link from email) ──────────────────────────────────────

  const [tokenStatus,  setTokenStatus]  = useState<'verifying' | 'success' | 'error' | null>(
    token ? 'verifying' : null,
  )
  const [tokenMessage, setTokenMessage] = useState('')

  useEffect(() => {
    if (!token) return

    const apiUrl = import.meta.env.VITE_API_URL

    async function verifyRecovery() {
      try {
        const res = await fetch(
          `${apiUrl}/api/v1/tipster/email/recover/verify?token=${encodeURIComponent(token!)}`,
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as any).error ?? `Recovery failed (${res.status})`)
        }
        window.history.replaceState({}, '', '/')
        setTokenStatus('success')
        setTokenMessage('Recovery confirmed. Return to Tipster in your original browser and tap "I clicked the link — restore my data".')
      } catch (err) {
        setTokenStatus('error')
        setTokenMessage(err instanceof Error ? err.message : 'Recovery failed.')
      }
    }

    verifyRecovery()
  }, [])

  if (token) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          {tokenStatus === 'verifying' && (
            <>
              <div className={styles.spinner} />
              <p className={styles.text}>Confirming recovery…</p>
            </>
          )}
          {tokenStatus === 'success' && (
            <>
              <p className={styles.iconOk}>✓</p>
              <p className={styles.text}>{tokenMessage}</p>
              <p className={styles.sub}>You can close this tab.</p>
            </>
          )}
          {tokenStatus === 'error' && (
            <>
              <p className={styles.iconErr}>✕</p>
              <p className={styles.text}>{tokenMessage}</p>
              <button
                className={styles.btn}
                onClick={() => { window.history.replaceState({}, '', '/'); setPage('home') }}
              >
                Go to Home
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Manual mode (initiated from Settings) ─────────────────────────────────

  return (
    <RecoverForm
      onCancel={() => setPage('settings')}
      onSuccess={() => setPage('home')}
      setDeviceId={setDeviceId}
    />
  )
}

function RecoverForm({
  onCancel,
  onSuccess,
  setDeviceId,
}: {
  onCancel:    () => void
  onSuccess:   () => void
  setDeviceId: (id: string) => void
}) {
  const [email,      setEmail]      = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendError,  setSendError]  = useState('')
  const [claimToken, setClaimToken] = useState<string | null>(null)
  const [claiming,   setClaiming]   = useState(false)
  const [claimError, setClaimError] = useState('')

  async function handleSend() {
    const apiUrl = import.meta.env.VITE_API_URL
    setSendStatus('sending')
    setSendError('')
    try {
      const res  = await fetch(`${apiUrl}/api/v1/tipster/email/recover`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const body = await res.json()
      setClaimToken(body.claimToken ?? null)
      setSendStatus('sent')
    } catch {
      setSendError('Could not send. Please check your connection and try again.')
      setSendStatus('error')
    }
  }

  async function handleClaim() {
    if (!claimToken) return
    const apiUrl = import.meta.env.VITE_API_URL
    setClaiming(true)
    setClaimError('')
    try {
      const res  = await fetch(`${apiUrl}/api/v1/tipster/email/recover/claim?claimToken=${encodeURIComponent(claimToken)}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not restore.')
      if (!body.confirmed) {
        setClaimError('Not confirmed yet — click the link in your email first, then try again.')
        return
      }
      setDeviceId(body.deviceId)
      onSuccess()
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not restore. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  if (sendStatus === 'sent') {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.iconOk}>✉</p>
          <p className={styles.heading}>Check your inbox</p>
          <p className={styles.sub}>
            If <strong>{email}</strong> is registered, we've sent a recovery link.
            Click it, then tap below.
          </p>
          {claimError && <p className={styles.error}>{claimError}</p>}
          <button
            className={`${styles.btn} ${claiming ? styles.btnDisabled : ''}`}
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? 'Restoring…' : 'I clicked the link — restore my data'}
          </button>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <p className={styles.heading}>Recover your data</p>
        <p className={styles.sub}>
          Enter the email you verified on your other device. We'll send a link to restore
          your data here.
        </p>
        <input
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        {sendError && <p className={styles.error}>{sendError}</p>}
        <button
          className={`${styles.btn} ${(!email || sendStatus === 'sending') ? styles.btnDisabled : ''}`}
          onClick={handleSend}
          disabled={!email || sendStatus === 'sending'}
        >
          {sendStatus === 'sending' ? 'Sending…' : 'Send recovery link'}
        </button>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
