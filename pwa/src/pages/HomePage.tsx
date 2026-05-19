import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { calculateTip, formatCurrency } from '../services/tipCalculator'
import type { Currency } from '../store/appStore'
import { SaveSharePanel } from '../components/SaveSharePanel'
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
    resetHomeForm,
  } = useAppStore()

  const [billFocused,   setBillFocused]   = useState(false)
  const [showSavePanel, setShowSavePanel] = useState(false)
  const [showModal,     setShowModal]     = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)

  // Scroll the panel into view after it renders
  useEffect(() => {
    if (!showSavePanel) return
    const t = setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => clearTimeout(t)
  }, [showSavePanel])

  // billText stores raw digit characters; decimal is implied at 2 places from right
  const bill = billText ? parseInt(billText) / 100 : 0

  function formatBillDisplay(digits: string): string {
    if (!digits) return ''
    return (parseInt(digits) / 100).toFixed(2)
  }

  function handleBillChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    setBillText(digits)
  }

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
    if (!hasAmount || showSavePanel) return
    setShowSavePanel(true)
  }

  function handleSaveSuccess(_message: string) {
    setShowModal(true)
  }

  function handleModalDismiss() {
    setShowModal(false)
    setShowSavePanel(false)
    resetHomeForm()
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
              inputMode="numeric"
              placeholder="0.00"
              value={formatBillDisplay(billText)}
              onChange={handleBillChange}
              onFocus={e => { setBillFocused(true); e.target.select() }}
              onBlur={() => setBillFocused(false)}
            />
            {billFocused && billText.length > 0 && (
              <button
                className={styles.billClear}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setBillText('')}
                aria-label="Clear"
              >
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
            <span className={styles.summaryPct}>{Math.round(result.tipPctFinal)}%</span>
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
          <button
            className={`${styles.saveBtn} ${hasAmount && !showSavePanel ? styles.saveBtnActive : ''} ${showSavePanel ? styles.saveBtnOpen : ''}`}
            onClick={handleSaveShare}
            disabled={!hasAmount || showSavePanel}
          >
            Save &amp; Share
            {!hasAmount && <span className={styles.saveBadge}>Add a bill amount first</span>}
          </button>
        </div>

        {/* Save & Share panel — expands below button, scroll reveals naturally */}
        {showSavePanel && (
          <div ref={panelRef}>
            <SaveSharePanel result={result} onSuccess={handleSaveSuccess} />
          </div>
        )}

        <div className={styles.bottomPad} />
      </div>

      {/* Success modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={handleModalDismiss}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalEmoji} aria-hidden="true">
              🥳🎊🎉🎊🥳
            </div>
            <p className={styles.modalTitle}>Thanks for sharing!</p>
            <p className={styles.modalSub}>Your rating helps the community.</p>
            <button className={styles.modalDismiss} onClick={handleModalDismiss}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
