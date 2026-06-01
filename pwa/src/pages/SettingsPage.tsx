import { useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { AddToHomeModal } from '../components/AddToHomeModal'
import type { Currency, TipVariable } from '../store/appStore'
import styles from './SettingsPage.module.css'

type EmailSendStatus = 'idle' | 'sending' | 'sent' | 'error'

const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'GBP', label: 'GBP', symbol: '£' },
  { value: 'CAD', label: 'CAD', symbol: 'CA$' },
  { value: 'EUR', label: 'EUR', symbol: '€' },
]

const ROW_HEIGHT = 48

function getEqualDistribution(variables: TipVariable[]): TipVariable[] {
  const n = variables.length
  if (n === 0) return variables
  const base = Math.floor(100 / n)
  const remainder = 100 - base * n
  return variables.map((v, i) => ({ ...v, customPct: i === 0 ? base + remainder : base }))
}

export function SettingsPage() {
  const {
    settings,
    setPage,
    deviceId,
    updateSettings,
    addVariable,
    removeVariable,
    updateVariable,
    reorderVariables,
    resetSettings,
    recoveryEmail,
    setRecoveryEmail,
    recoveryEmailVerified,
  } = useAppStore()

  const [confirmed, setConfirmed] = useState(false)
  const [focusedInput, setFocusedInput] = useState<string | null>(null)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const { installState, promptInstall } = useInstallPrompt()

  // Drag state — ref for mutable tracking, state for visual re-renders
  const dragRef = useRef<{ from: number; to: number } | null>(null)
  const dragStartY = useRef(0)
  const [dragVisual, setDragVisual] = useState<{ from: number; to: number } | null>(null)

  // Swipe-to-delete state
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null)

  // Recovery email verification
  const [emailSendStatus,  setEmailSendStatus]  = useState<EmailSendStatus>('idle')
  const [emailSendError,   setEmailSendError]    = useState('')
  const [checkingStatus,   setCheckingStatus]    = useState(false)

  async function handleSendVerifyEmail() {
    const apiUrl = import.meta.env.VITE_API_URL
    setEmailSendStatus('sending')
    setEmailSendError('')
    try {
      const res = await fetch(`${apiUrl}/api/v1/tipster/email/request`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deviceId, email: recoveryEmail }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // 409 means the email is already registered — check if it belongs to
        // this device (local state fell out of sync) or a different one (recovery needed)
        if (res.status === 409) {
          const statusRes  = await fetch(`${apiUrl}/api/v1/tipster/email/status?deviceId=${deviceId}`)
          const statusBody = await statusRes.json()
          if (statusBody.verified) {
            useAppStore.getState().setRecoveryEmailVerified(true)
            setEmailSendStatus('idle')
            return
          }
        }
        throw new Error((body as any).error ?? 'Failed to send')
      }
      setEmailSendStatus('sent')
    } catch (err) {
      setEmailSendError(err instanceof Error ? err.message : 'Could not send. Please try again.')
      setEmailSendStatus('error')
    }
  }

  async function handleCheckVerification() {
    if (!deviceId) return
    const apiUrl = import.meta.env.VITE_API_URL
    setCheckingStatus(true)
    try {
      const res  = await fetch(`${apiUrl}/api/v1/tipster/email/status?deviceId=${deviceId}`)
      const body = await res.json()
      if (body.verified) {
        useAppStore.getState().setRecoveryEmailVerified(true)
        setEmailSendStatus('idle')
      } else {
        setEmailSendError("Not verified yet — check your inbox and click the link first.")
      }
    } catch {
      setEmailSendError('Could not check status. Please try again.')
    } finally {
      setCheckingStatus(false)
    }
  }
  const swipeRef = useRef<{ id: string; startX: number; startY: number; active: boolean; cancelled: boolean } | null>(null)

  function handleReset() {
    if (!confirmed) { setConfirmed(true); return }
    resetSettings()
    setConfirmed(false)
  }

  function switchToCustom() {
    if (settings.variableCalcMethod === 'CUSTOM') return
    updateSettings({ variableCalcMethod: 'CUSTOM', variables: getEqualDistribution(settings.variables) })
  }

  function distributeCustomPcts() {
    updateSettings({ variables: getEqualDistribution(settings.variables) })
  }

  function handleDragStart(e: React.PointerEvent<HTMLElement>, idx: number) {
    setSwipeOpenId(null)
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY
    dragRef.current = { from: idx, to: idx }
    setDragVisual({ from: idx, to: idx })
  }

  function handleDragMove(e: React.PointerEvent) {
    const info = dragRef.current
    if (!info) return
    const offset = Math.round((e.clientY - dragStartY.current) / ROW_HEIGHT)
    const to = Math.max(0, Math.min(settings.variables.length - 1, info.from + offset))
    if (to !== info.to) {
      dragRef.current = { from: info.from, to }
      setDragVisual({ from: info.from, to })
    }
  }

  function handleDragEnd() {
    const d = dragRef.current
    if (d && d.from !== d.to) {
      reorderVariables(d.from, d.to)
    }
    dragRef.current = null
    setDragVisual(null)
  }

  function onContentDown(e: React.PointerEvent<HTMLElement>, id: string) {
    if (swipeOpenId && swipeOpenId !== id) { setSwipeOpenId(null); return }
    swipeRef.current = { id, startX: e.clientX, startY: e.clientY, active: false, cancelled: false }
  }

  function onContentMove(e: React.PointerEvent) {
    const s = swipeRef.current
    if (!s || s.cancelled) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY
    if (!s.active) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { s.cancelled = true; return }
      if (Math.abs(dx) > 8) s.active = true
    }
  }

  function onContentUp(e: React.PointerEvent) {
    const s = swipeRef.current; swipeRef.current = null
    if (!s) return
    if (!s.active) { if (swipeOpenId === s.id) setSwipeOpenId(null); return }
    const dx = e.clientX - s.startX
    setSwipeOpenId(dx < -36 ? s.id : null)
  }

  const customSum = settings.variables.reduce((sum, v) => sum + (v.customPct ?? 0), 0)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => setPage('home')}>← Back</button>
        <h1 className={styles.title}>Settings</h1>
        <div style={{ width: 60 }} />
      </header>

      {/* Currency */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Currency</h2>
        <div className={styles.segmented}>
          {CURRENCY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.segBtn} ${settings.currency === opt.value ? styles.segActive : ''}`}
              onClick={() => updateSettings({ currency: opt.value })}
            >
              {opt.symbol} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Max tip % */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Maximum tip</h2>
        <div className={styles.stepperRow}>
          <button
            className={styles.stepBtn}
            onClick={() => updateSettings({ maxTipPct: Math.max(1, settings.maxTipPct - 1) })}
            disabled={settings.maxTipPct <= 1}
          >−</button>
          <span className={styles.stepValue}>{settings.maxTipPct}%</span>
          <button
            className={styles.stepBtn}
            onClick={() => updateSettings({ maxTipPct: Math.min(50, settings.maxTipPct + 1) })}
            disabled={settings.maxTipPct >= 50}
          >+</button>
        </div>
        <p className={styles.meta}>This is the best tip an employee can receive.</p>
      </div>

      {/* Fixed tip */}
      <div className={styles.section}>
        <div className={styles.toggleRow}>
          <div>
            <h2 className={styles.sectionTitle}>Fixed tip</h2>
            <p className={styles.meta}>A guaranteed baseline percentage</p>
          </div>
          <button
            className={`${styles.toggle} ${settings.hasFixed ? styles.toggleOn : ''}`}
            onClick={() => updateSettings({ hasFixed: !settings.hasFixed })}
            aria-label={settings.hasFixed ? 'Disable fixed tip' : 'Enable fixed tip'}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>

        {settings.hasFixed && (
          <>
            <div className={styles.stepperRow} style={{ marginTop: 12 }}>
              <button
                className={styles.stepBtn}
                onClick={() => updateSettings({ fixedTipPct: Math.max(0, settings.fixedTipPct - 1) })}
                disabled={settings.fixedTipPct <= 0}
              >−</button>
              <span className={styles.stepValue}>{settings.fixedTipPct}%</span>
              <button
                className={styles.stepBtn}
                onClick={() => updateSettings({ fixedTipPct: Math.min(settings.maxTipPct, settings.fixedTipPct + 1) })}
                disabled={settings.fixedTipPct >= settings.maxTipPct}
              >+</button>
            </div>
            <p className={styles.inputLabel} style={{ marginTop: 10 }}>Fixed amount as labeled during calculation:</p>
            <div className={styles.textInputWrap} style={{ marginTop: 4 }}>
              <input
                className={styles.textInput}
                value={settings.fixedTipNickname}
                onChange={e => updateSettings({ fixedTipNickname: e.target.value })}
                placeholder="Nickname for this fixed tip"
                onFocus={() => setFocusedInput('nickname')}
                onBlur={() => setFocusedInput(null)}
              />
              {focusedInput === 'nickname' && settings.fixedTipNickname && (
                <button
                  className={styles.textInputClear}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => updateSettings({ fixedTipNickname: '' })}
                >×</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Round up */}
      <div className={styles.section}>
        <div className={styles.toggleRow}>
          <div>
            <h2 className={styles.sectionTitle}>Round up tip amount</h2>
            <p className={styles.meta}>Rounds the tip up to the nearest whole dollar</p>
          </div>
          <button
            className={`${styles.toggle} ${settings.roundUp ? styles.toggleOn : ''}`}
            onClick={() => updateSettings({ roundUp: !settings.roundUp })}
            aria-label={settings.roundUp ? 'Disable round up' : 'Enable round up'}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>
      </div>

      {/* Variable calc method */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Variable tip calculation</h2>
        <div className={styles.segmented}>
          <button
            className={`${styles.segBtn} ${settings.variableCalcMethod === 'EQUAL' ? styles.segActive : ''}`}
            onClick={() => updateSettings({ variableCalcMethod: 'EQUAL' })}
          >Equal weight</button>
          <button
            className={`${styles.segBtn} ${settings.variableCalcMethod === 'CUSTOM' ? styles.segActive : ''}`}
            onClick={switchToCustom}
          >Custom weight</button>
        </div>
        {settings.variableCalcMethod === 'EQUAL' && (
          <p className={styles.meta} style={{ marginTop: 6 }}>Each variable contributes equally to the tip pool.</p>
        )}
        {settings.variableCalcMethod === 'CUSTOM' && (
          <p className={styles.meta} style={{ marginTop: 6 }}>Each variable has a user-defined contribution.</p>
        )}
      </div>

      {/* Variables */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Tip variables</h2>
        <p className={styles.meta}>Up to 7. Each rated 1–5 by the tipper. Swipe left to delete.</p>
        {settings.variableCalcMethod === 'CUSTOM' && (
          <>
            <p className={`${styles.meta} ${customSum !== 100 ? styles.metaWarn : styles.metaOk}`} style={{ marginTop: 2 }}>
              Weights sum: {customSum}%{customSum !== 100 ? ' — must equal 100%' : ' ✓'}
            </p>
            <button className={styles.distributeBtn} onClick={distributeCustomPcts}>
              Distribute equally
            </button>
          </>
        )}

        <div className={styles.varList}>
          {settings.variables.map((v, i) => (
            <div
              key={v.id}
              className={[
                styles.varRow,
                dragVisual?.from === i ? styles.varRowDragging : '',
              ].join(' ')}
            >
              <div
                className={styles.dragHandle}
                onPointerDown={e => handleDragStart(e, i)}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
              >⠿</div>

              <div className={styles.varTrack}>
                <div className={styles.varDeleteZone}>
                  <button
                    className={styles.varDeleteBtn}
                    onClick={() => { setSwipeOpenId(null); removeVariable(v.id) }}
                  >Delete</button>
                </div>
                <div
                  className={[
                    styles.varContent,
                    dragVisual?.to === i && dragVisual.to !== dragVisual.from ? styles.varContentDropTarget : '',
                  ].join(' ')}
                  style={{ transform: swipeOpenId === v.id ? 'translateX(-72px)' : 'translateX(0)' }}
                  onPointerDown={e => onContentDown(e, v.id)}
                  onPointerMove={onContentMove}
                  onPointerUp={onContentUp}
                  onPointerCancel={() => { swipeRef.current = null }}
                >
                  <div className={styles.varLabelWrap}>
                    <input
                      className={styles.varLabel}
                      value={v.label}
                      onChange={e => updateVariable(v.id, { label: e.target.value })}
                      placeholder="Variable name"
                      onFocus={() => setFocusedInput(v.id)}
                      onBlur={() => setFocusedInput(null)}
                    />
                    {focusedInput === v.id && v.label && (
                      <button
                        className={styles.varLabelClear}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => updateVariable(v.id, { label: '' })}
                      >×</button>
                    )}
                  </div>
                  {settings.variableCalcMethod === 'CUSTOM' && (
                    <div className={styles.varStepper}>
                      <button
                        className={styles.varStepBtn}
                        onClick={() => updateVariable(v.id, { customPct: Math.max(0, (v.customPct ?? 0) - 1) })}
                        disabled={(v.customPct ?? 0) <= 0}
                      >−</button>
                      <span className={styles.varStepValue}>{v.customPct ?? 0}%</span>
                      <button
                        className={styles.varStepBtn}
                        onClick={() => updateVariable(v.id, { customPct: Math.min(100, (v.customPct ?? 0) + 1) })}
                        disabled={(v.customPct ?? 0) >= 100}
                      >+</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {settings.variables.length < 7 && (
          <button className={styles.addBtn} onClick={addVariable}>+ Add variable</button>
        )}
      </div>

      {/* Recovery Email */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Recovery email</h2>
        {recoveryEmailVerified
          ? <p className={styles.meta}><span className={styles.metaOk}>Verified</span>{recoveryEmail ? ` — ${recoveryEmail}` : ''}</p>
          : <p className={styles.meta}>Set an email to recover your data if you switch devices.</p>
        }
        <div className={styles.textInputWrap} style={{ marginTop: 8 }}>
          <input
            className={styles.textInput}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="your@email.com"
            value={recoveryEmail}
            onChange={e => { setRecoveryEmail(e.target.value); setEmailSendStatus('idle') }}
            onFocus={() => setFocusedInput('email')}
            onBlur={() => setFocusedInput(null)}
          />
          {focusedInput === 'email' && recoveryEmail && (
            <button
              className={styles.textInputClear}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setRecoveryEmail(''); setEmailSendStatus('idle') }}
            >×</button>
          )}
        </div>
        {!recoveryEmailVerified && recoveryEmail && emailSendStatus !== 'sent' && (
          <button
            className={styles.installBtn}
            style={{ marginTop: 8 }}
            onClick={handleSendVerifyEmail}
            disabled={emailSendStatus === 'sending'}
          >
            {emailSendStatus === 'sending' ? 'Sending…' : 'Send verification link'}
          </button>
        )}
        {emailSendStatus === 'sent' && (
          <>
            <p className={styles.meta} style={{ marginTop: 8 }}>
              Check your inbox and click the link, then tap below.
            </p>
            <button
              className={styles.installBtn}
              style={{ marginTop: 8 }}
              onClick={handleCheckVerification}
              disabled={checkingStatus}
            >
              {checkingStatus ? 'Checking…' : 'I clicked the link — confirm verification'}
            </button>
          </>
        )}
        {emailSendError && (
          <p className={styles.meta} style={{ marginTop: 8, color: 'var(--color-red)' }}>
            {emailSendError}
          </p>
        )}
      </div>

      {/* Recover from another device */}
      {!recoveryEmailVerified && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>New device?</h2>
          <p className={styles.meta}>Already have Tipster data? Recover it from your other device.</p>
          <button
            className={styles.legalBtn}
            onClick={() => setPage('recover')}
          >
            Recover data from another device
          </button>
        </div>
      )}

      {/* Install app */}
      {(installState === 'android' || installState === 'ios') && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Install app</h2>
          <p className={styles.meta}>Add mooki Tipster to your home screen for quick access.</p>
          <button
            className={styles.installBtn}
            onClick={() => installState === 'android' ? promptInstall() : setShowInstallModal(true)}
          >
            Add to Home Screen
          </button>
        </div>
      )}

      {/* Legal */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Legal</h2>
        <button className={styles.legalBtn} onClick={() => window.open('https://www.mooki-apps.com/terms', '_blank')}>
          Terms of Service
        </button>
        <button className={styles.legalBtn} onClick={() => window.open('https://www.mooki-apps.com/privacy', '_blank')}>
          Privacy Policy
        </button>
      </div>

      {/* Reset */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Reset app</h2>
        <p className={styles.meta}>Clears all local settings and restores defaults.</p>
        <button
          className={`${styles.resetBtn} ${confirmed ? styles.resetConfirm : ''}`}
          onClick={handleReset}
        >
          {confirmed ? 'Tap again to confirm reset' : 'Reset all data'}
        </button>
      </div>

      <div className={styles.footer}>
        <p>mooki Tipster — Simple apps for a simple life.™</p>
        <p style={{ marginTop: 4 }}>No account. No tracking. No fuss.</p>
      </div>

      {showInstallModal && <AddToHomeModal onClose={() => setShowInstallModal(false)} />}
    </div>
  )
}
