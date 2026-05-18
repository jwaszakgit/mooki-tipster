import { useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { clearLocalData } from '../services/localStore'
import type { Currency } from '../store/appStore'
import styles from './SettingsPage.module.css'

const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'GBP', label: 'GBP', symbol: '£' },
  { value: 'CAD', label: 'CAD', symbol: 'CA$' },
  { value: 'EUR', label: 'EUR', symbol: '€' },
]

const ROW_HEIGHT = 48

export function SettingsPage() {
  const {
    settings,
    setPage,
    updateSettings,
    addVariable,
    removeVariable,
    updateVariable,
    reorderVariables,
    recoveryEmail,
    setRecoveryEmail,
  } = useAppStore()

  const [confirmed, setConfirmed] = useState(false)

  // Drag state — ref for mutable tracking, state for visual re-renders
  const dragRef = useRef<{ from: number; to: number } | null>(null)
  const dragStartY = useRef(0)
  const [dragVisual, setDragVisual] = useState<{ from: number; to: number } | null>(null)

  function handleReset() {
    if (!confirmed) { setConfirmed(true); return }
    clearLocalData().then(() => {
      localStorage.removeItem('mooki_tipster_device_id')
      window.location.reload()
    })
  }

  function switchToCustom() {
    if (settings.variableCalcMethod === 'CUSTOM') return
    const n = settings.variables.length
    if (n === 0) { updateSettings({ variableCalcMethod: 'CUSTOM' }); return }
    const base = Math.floor(100 / n)
    const remainder = 100 - base * n
    const variables = settings.variables.map((v, i) => ({
      ...v,
      customPct: i === 0 ? base + remainder : base,
    }))
    updateSettings({ variableCalcMethod: 'CUSTOM', variables })
  }

  function handleDragStart(e: React.PointerEvent<HTMLElement>, idx: number) {
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
            <input
              className={styles.textInput}
              style={{ marginTop: 4 }}
              value={settings.fixedTipNickname}
              onChange={e => updateSettings({ fixedTipNickname: e.target.value })}
              placeholder="Nickname for this fixed tip"
            />
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
        <p className={styles.meta}>Up to 7. Each rated 1–5 by the tipper.</p>
        {settings.variableCalcMethod === 'CUSTOM' && (
          <p className={`${styles.meta} ${customSum !== 100 ? styles.metaWarn : styles.metaOk}`} style={{ marginTop: 2 }}>
            Weights sum: {customSum}%{customSum !== 100 ? ' — must equal 100%' : ' ✓'}
          </p>
        )}

        <div className={styles.varList}>
          {settings.variables.map((v, i) => (
            <div
              key={v.id}
              className={[
                styles.varRow,
                dragVisual?.from === i ? styles.varRowDragging : '',
                dragVisual?.to === i && dragVisual.to !== dragVisual.from ? styles.varRowDropTarget : '',
              ].join(' ')}
            >
              <div
                className={styles.dragHandle}
                onPointerDown={e => handleDragStart(e, i)}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
              >⠿</div>
              <input
                className={styles.varLabel}
                value={v.label}
                onChange={e => updateVariable(v.id, { label: e.target.value })}
                placeholder="Variable name"
              />
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
              <button
                className={styles.removeBtn}
                onClick={() => removeVariable(v.id)}
                aria-label="Remove variable"
              >×</button>
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
        <p className={styles.meta}>Used to recover your settings with a magic link if you switch devices.</p>
        <input
          className={styles.textInput}
          style={{ marginTop: 8 }}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={recoveryEmail}
          onChange={e => setRecoveryEmail(e.target.value)}
        />
      </div>

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
        <p>mooki tipster — Simple apps for a simple life.™</p>
        <p style={{ marginTop: 4 }}>No account. No tracking. No fuss.</p>
      </div>
    </div>
  )
}
