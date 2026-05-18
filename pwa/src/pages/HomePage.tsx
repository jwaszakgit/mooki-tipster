import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { calculateTip, formatCurrency } from '../services/tipCalculator'
import type { Currency } from '../store/appStore'
import styles from './HomePage.module.css'

const LIKERT_EMOJI = ['😢', '😑', '😐', '🙂', '😁'] as const

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  GBP: '£',
  CAD: 'CA$',
  EUR: '€',
}

export function HomePage() {
  const {
    settings,
    setPage,
    billText, setBillText,
    likertRatings, setLikert,
    splitBy, setSplitBy,
  } = useAppStore()

  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current) }
  }, [])

  const bill = parseFloat(billText) || 0

  const result = useMemo(() => {
    const variables = settings.variables.map(v => ({
      label: v.label,
      customPct: v.customPct,
      likertValue: likertRatings[v.id] ?? 3,
    }))
    return calculateTip({ ...settings }, variables, bill, splitBy)
  }, [bill, likertRatings, splitBy, settings])

  const hasAmount = bill > 0
  const billTotal = hasAmount
    ? formatCurrency(bill + result.tipAmountFinal, settings.currency)
    : null
  const fixedAmount = hasAmount
    ? formatCurrency((bill * settings.fixedTipPct) / 100, settings.currency)
    : null

  function handleSaveShare() {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    setShowTooltip(true)
    tooltipTimer.current = setTimeout(() => setShowTooltip(false), 2500)
  }

  const symbol = CURRENCY_SYMBOL[settings.currency]

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandM}>m</span>
          <span className={styles.brandRest}>ooki tipster</span>
        </div>
        <button className={styles.gear} onClick={() => setPage('settings')} aria-label="Settings">
          ⚙️
        </button>
      </header>

      <div className={styles.scroll}>

        {/* Bill Amount */}
        <section className={styles.card}>
          <p className={styles.cardLabel}>Bill Amount</p>
          <div className={styles.billRow}>
            <span className={styles.currencySymbol}>{symbol}</span>
            <input
              className={styles.billInput}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={billText}
              onChange={e => {
                const val = e.target.value
                if (/^(\d*\.?\d{0,2})?$/.test(val)) setBillText(val)
              }}
              onFocus={e => e.target.select()}
            />
            {billText.length > 0 && (
              <button className={styles.billClear} onClick={() => setBillText('')} aria-label="Clear">
                ×
              </button>
            )}
          </div>
        </section>

        {/* Fixed Tip */}
        {settings.hasFixed && (
          <section className={styles.card}>
            <p className={styles.cardLabel}>Fixed Tip</p>
            <div className={styles.fixedRow}>
              <span className={styles.fixedNickname}>{settings.fixedTipNickname}</span>
              <div className={styles.fixedAmounts}>
                <span className={styles.fixedPct}>{settings.fixedTipPct}%</span>
                {fixedAmount && <span className={styles.fixedAmt}>{fixedAmount}</span>}
              </div>
            </div>
          </section>
        )}

        {/* Variable Ratings */}
        {settings.variables.length > 0 && (
          <section className={styles.card}>
            <p className={styles.cardLabel}>Rating</p>
            <div className={styles.varList}>
              {settings.variables.map((v, i) => (
                <div key={v.id} className={styles.varItem}>
                  <p className={styles.varName}>{v.label || `Variable ${i + 1}`}</p>
                  <div className={styles.likertRow}>
                    {LIKERT_EMOJI.map((emoji, idx) => {
                      const value = idx + 1
                      const selected = (likertRatings[v.id] ?? 3) === value
                      return (
                        <button
                          key={value}
                          className={`${styles.likertBtn} ${selected ? styles.likertSelected : ''}`}
                          onClick={() => setLikert(v.id, value)}
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
        )}

        {/* Tip Summary */}
        <section className={styles.card}>
          <p className={styles.cardLabel}>Tip Summary</p>
          <div className={styles.summaryGrid}>
            <span className={styles.summaryKey}>Tip</span>
            <span className={styles.summaryPct}>{result.tipPctFinal.toFixed(1)}%</span>
            <span className={styles.summaryAmt}>{hasAmount ? result.formatted.tipAmountFinal : '—'}</span>

            <span className={`${styles.summaryKey} ${styles.summaryTotalKey}`}>Total</span>
            <span />
            <span className={`${styles.summaryAmt} ${styles.summaryTotalAmt}`}>{billTotal ?? '—'}</span>
          </div>
        </section>

        {/* Split */}
        <section className={styles.card}>
          <p className={styles.cardLabel}>Split</p>
          <div className={styles.splitWrap}>
            <div className={styles.splitScroll}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  className={`${styles.splitBtn} ${splitBy === n ? styles.splitActive : ''}`}
                  onClick={() => setSplitBy(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className={styles.splitFade} aria-hidden="true" />
          </div>
          {splitBy > 1 && (
            <div className={styles.perPerson}>
              <div className={styles.summaryGrid}>
                <span className={styles.summaryKey}>Per person tip</span>
                <span />
                <span className={styles.summaryAmt}>{hasAmount ? result.formatted.perPersonTip : '—'}</span>

                <span className={`${styles.summaryKey} ${styles.summaryTotalKey}`}>Per person total</span>
                <span />
                <span className={`${styles.summaryAmt} ${styles.summaryTotalAmt}`}>{hasAmount ? result.formatted.perPersonTotal : '—'}</span>
              </div>
            </div>
          )}
        </section>

        {/* Save & Share */}
        <div className={styles.saveWrap}>
          <button className={styles.saveBtn} onClick={handleSaveShare}>
            Save &amp; Share
            <span className={styles.saveBadge}>Coming Soon</span>
          </button>
          {showTooltip && <p className={styles.tooltip}>Rating sharing coming soon.</p>}
        </div>

        <div className={styles.bottomPad} />
      </div>
    </div>
  )
}
