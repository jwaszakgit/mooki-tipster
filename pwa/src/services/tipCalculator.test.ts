import { describe, it, expect } from 'vitest'
import { calculateTip, formatCurrency } from './tipCalculator'
import type { TipSettings, VariableRating } from './tipCalculator'

// ── Shared fixtures ────────────────────────────────────────────────────────

const BASE: TipSettings = {
  maxTipPct: 25,
  hasFixed: true,
  fixedTipPct: 10,
  variableCalcMethod: 'EQUAL',
  currency: 'USD',
  roundUp: false,
}

const NO_FIXED: TipSettings = { ...BASE, hasFixed: false }

const CUSTOM: TipSettings = { ...BASE, variableCalcMethod: 'CUSTOM' }
const CUSTOM_NO_FIXED: TipSettings = { ...NO_FIXED, variableCalcMethod: 'CUSTOM' }

// 4 variables all at middle Likert (3 → 50% weight)
const MID4: VariableRating[] = [
  { label: 'Service',  likertValue: 3 },
  { label: 'Food',     likertValue: 3 },
  { label: 'Drinks',   likertValue: 3 },
  { label: 'Ambiance', likertValue: 3 },
]

const HAPPY4: VariableRating[] = MID4.map(v => ({ ...v, likertValue: 5 }))
const SAD4:   VariableRating[] = MID4.map(v => ({ ...v, likertValue: 1 }))

// 3 variables with explicit custom weights
const CUSTOM_VARS: VariableRating[] = [
  { label: 'Service',  customPct: 50, likertValue: 5 }, // 50% of pool, full weight
  { label: 'Food',     customPct: 30, likertValue: 3 }, // 30% of pool, half weight
  { label: 'Ambiance', customPct: 20, likertValue: 1 }, // 20% of pool, zero weight
]

// ── Equal mode ─────────────────────────────────────────────────────────────

describe('equal mode — with fixed', () => {
  // variablePool = 25 – 10 = 15, each share = 15/4 = 3.75, weight = 0.5
  // variable total = 4 × (3.75 × 0.5) = 7.5 → tip = 10 + 7.5 = 17.5%
  it('4 variables all middle Likert → 17.5% tip', () => {
    const r = calculateTip(BASE, MID4, 100)
    expect(r.tipPctFinal).toBeCloseTo(17.5, 6)
    expect(r.tipAmountFinal).toBeCloseTo(17.5, 6)
    expect(r.perPersonTip).toBeCloseTo(17.5, 6)
    expect(r.perPersonTotal).toBeCloseTo(117.5, 6)
  })

  it('all happy face (Likert 5) → maxTipPct (25%)', () => {
    const r = calculateTip(BASE, HAPPY4, 100)
    expect(r.tipPctFinal).toBeCloseTo(25, 6)
  })

  it('all sad face (Likert 1) → fixed tip only (10%)', () => {
    const r = calculateTip(BASE, SAD4, 100)
    expect(r.tipPctFinal).toBeCloseTo(10, 6)
    expect(r.perVariableContribution.every(c => c.pctContribution === 0)).toBe(true)
  })

  it('0 variables → fixed tip only (10%)', () => {
    const r = calculateTip(BASE, [], 100)
    expect(r.tipPctFinal).toBeCloseTo(10, 6)
    expect(r.perVariableContribution).toHaveLength(0)
  })

  it('per-variable contributions sum to variable portion', () => {
    const r = calculateTip(BASE, MID4, 100)
    const contribSum = r.perVariableContribution.reduce((s, c) => s + c.pctContribution, 0)
    expect(contribSum).toBeCloseTo(r.tipPctFinal - BASE.fixedTipPct, 6)
  })
})

describe('equal mode — without fixed (hasFixed: false)', () => {
  // variablePool = 25 – 0 = 25, each share = 25/4 = 6.25, weight = 0.5
  // variable total = 4 × (6.25 × 0.5) = 12.5%
  it('4 variables all middle Likert → 12.5% tip', () => {
    const r = calculateTip(NO_FIXED, MID4, 100)
    expect(r.tipPctFinal).toBeCloseTo(12.5, 6)
  })

  it('all happy face → maxTipPct (25%)', () => {
    const r = calculateTip(NO_FIXED, HAPPY4, 100)
    expect(r.tipPctFinal).toBeCloseTo(25, 6)
  })

  it('all sad face → 0% tip', () => {
    const r = calculateTip(NO_FIXED, SAD4, 100)
    expect(r.tipPctFinal).toBe(0)
    expect(r.tipAmountFinal).toBe(0)
  })

  it('0 variables → 0% tip', () => {
    const r = calculateTip(NO_FIXED, [], 100)
    expect(r.tipPctFinal).toBe(0)
    expect(r.tipAmountFinal).toBe(0)
  })
})

// ── Custom mode ────────────────────────────────────────────────────────────

describe('custom mode — with fixed', () => {
  // variablePool = 15
  // var1: (50/100) × 15 × 1.00 = 7.50
  // var2: (30/100) × 15 × 0.50 = 2.25
  // var3: (20/100) × 15 × 0.00 = 0.00   → variable total = 9.75 → tip = 19.75%
  it('weights [50/30/20] likert [5/3/1] → 19.75% tip', () => {
    const r = calculateTip(CUSTOM, CUSTOM_VARS, 100)
    expect(r.tipPctFinal).toBeCloseTo(19.75, 6)
    expect(r.tipAmountFinal).toBeCloseTo(19.75, 6)
    expect(r.perVariableContribution[0].pctContribution).toBeCloseTo(7.5, 6)
    expect(r.perVariableContribution[1].pctContribution).toBeCloseTo(2.25, 6)
    expect(r.perVariableContribution[2].pctContribution).toBeCloseTo(0, 6)
  })

  it('all happy face → maxTipPct (25%)', () => {
    const r = calculateTip(CUSTOM, CUSTOM_VARS.map(v => ({ ...v, likertValue: 5 })), 100)
    expect(r.tipPctFinal).toBeCloseTo(25, 6)
  })

  it('all sad face → fixed tip only (10%)', () => {
    const r = calculateTip(CUSTOM, CUSTOM_VARS.map(v => ({ ...v, likertValue: 1 })), 100)
    expect(r.tipPctFinal).toBeCloseTo(10, 6)
  })

  it('normalises weights that do not sum to 100 — same ratio same result', () => {
    // [60, 40] and [30, 20] have the same ratio, should produce identical results
    const vars60_40: VariableRating[] = [
      { label: 'A', customPct: 60, likertValue: 4 },
      { label: 'B', customPct: 40, likertValue: 2 },
    ]
    const vars30_20: VariableRating[] = [
      { label: 'A', customPct: 30, likertValue: 4 },
      { label: 'B', customPct: 20, likertValue: 2 },
    ]
    const r1 = calculateTip(CUSTOM, vars60_40, 100)
    const r2 = calculateTip(CUSTOM, vars30_20, 100)
    expect(r1.tipPctFinal).toBeCloseTo(r2.tipPctFinal, 6)
  })
})

describe('custom mode — without fixed', () => {
  // variablePool = 25
  // var1: 0.50 × 25 × 1.00 = 12.50
  // var2: 0.30 × 25 × 0.50 = 3.75
  // var3: 0.20 × 25 × 0.00 = 0.00   → 16.25%
  it('weights [50/30/20] likert [5/3/1] → 16.25% tip', () => {
    const r = calculateTip(CUSTOM_NO_FIXED, CUSTOM_VARS, 100)
    expect(r.tipPctFinal).toBeCloseTo(16.25, 6)
  })

  it('all sad face → 0% tip', () => {
    const r = calculateTip(CUSTOM_NO_FIXED, CUSTOM_VARS.map(v => ({ ...v, likertValue: 1 })), 100)
    expect(r.tipPctFinal).toBe(0)
  })
})

// ── Split ──────────────────────────────────────────────────────────────────

describe('split calculation', () => {
  it('split by 1 is identity', () => {
    const r = calculateTip(BASE, MID4, 100, 1)
    expect(r.perPersonTip).toBeCloseTo(r.tipAmountFinal, 6)
    expect(r.perPersonTotal).toBeCloseTo(100 + r.tipAmountFinal, 6)
  })

  it('split by 4 on $200 bill at 17.5%', () => {
    // tipAmountFinal = 200 × 0.175 = 35
    // perPersonTip = 35 / 4 = 8.75
    // perPersonTotal = (200 + 35) / 4 = 58.75
    const r = calculateTip(BASE, MID4, 200, 4)
    expect(r.tipAmountFinal).toBeCloseTo(35, 6)
    expect(r.perPersonTip).toBeCloseTo(8.75, 6)
    expect(r.perPersonTotal).toBeCloseTo(58.75, 6)
  })

  it('split by 3 divides evenly', () => {
    const r = calculateTip(BASE, MID4, 300, 3)
    // tipAmountFinal = 300 × 0.175 = 52.50
    expect(r.perPersonTip).toBeCloseTo(17.5, 6)
    expect(r.perPersonTotal).toBeCloseTo(117.5, 6)
  })
})

// ── Round up ───────────────────────────────────────────────────────────────

describe('roundUp', () => {
  it('rounds tip to next whole dollar — $47 × 17.5% = $8.225 → $9', () => {
    const r = calculateTip({ ...BASE, roundUp: true }, MID4, 47)
    expect(r.tipAmountFinal).toBe(9)
    expect(r.tipPctFinal).toBeCloseTo((9 / 47) * 100, 4)
  })

  it('no-op when result is already whole — $80 × 17.5% = $14.00', () => {
    const r = calculateTip({ ...BASE, roundUp: true }, MID4, 80)
    expect(r.tipAmountFinal).toBe(14)
  })

  it('roundUp: false leaves fractional amounts untouched', () => {
    const r = calculateTip(BASE, MID4, 47)
    expect(r.tipAmountFinal).toBeCloseTo(8.225, 3)
  })

  it('split by 4 — tip ceils but per-person divides the ceiled tip', () => {
    // tipAmountFinal = ceil($47 × 17.5%) = ceil($8.225) = $9
    // perPersonTip   = 9 / 4 = $2.25  (no additional ceil)
    // perPersonTotal = (47 + 9) / 4   = $14.00
    const r = calculateTip({ ...BASE, roundUp: true }, MID4, 47, 4)
    expect(r.tipAmountFinal).toBe(9)
    expect(r.perPersonTip).toBeCloseTo(2.25, 6)
    expect(r.perPersonTotal).toBeCloseTo(14, 6)
  })

  it('split by 1 with roundUp — per-person equals ceiled tip', () => {
    const r = calculateTip({ ...BASE, roundUp: true }, MID4, 47, 1)
    expect(r.perPersonTip).toBe(r.tipAmountFinal)
    expect(r.perPersonTotal).toBeCloseTo(47 + r.tipAmountFinal, 6)
  })

  it('does not ceil if ceil would exceed maxTipPct', () => {
    // $7 bill, maxTipPct=25%, all HAPPY4 (Likert 5) → 25% → tip = $1.75
    // ceil($1.75) = $2 which is 28.57% > maxTipPct=25%, so no rounding
    const r = calculateTip({ ...BASE, maxTipPct: 25, roundUp: true }, HAPPY4, 7)
    expect(r.tipAmountFinal).toBeCloseTo(1.75, 6)
    expect(r.tipPctFinal).toBeCloseTo(25, 4)
  })
})

// ── Currency formatting ────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('USD → $17.50', () => expect(formatCurrency(17.5, 'USD')).toBe('$17.50'))
  it('GBP → £17.50', () => expect(formatCurrency(17.5, 'GBP')).toBe('£17.50'))
  it('CAD → CA$17.50', () => expect(formatCurrency(17.5, 'CAD')).toBe('CA$17.50'))
  it('EUR → €17.50', () => expect(formatCurrency(17.5, 'EUR')).toBe('€17.50'))

  it('formatted fields on result use the correct currency symbol', () => {
    const r = calculateTip({ ...BASE, currency: 'GBP' }, MID4, 100)
    expect(r.formatted.tipAmountFinal).toContain('£')
    expect(r.formatted.perPersonTip).toContain('£')
    expect(r.formatted.perPersonTotal).toContain('£')
  })
})
