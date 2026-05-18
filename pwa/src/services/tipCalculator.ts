export type Currency = 'USD' | 'GBP' | 'CAD' | 'EUR'
export type VariableCalcMethod = 'EQUAL' | 'CUSTOM'

export interface TipSettings {
  maxTipPct: number
  hasFixed: boolean
  fixedTipPct: number
  variableCalcMethod: VariableCalcMethod
  currency: Currency
  roundUp: boolean
}

export interface VariableRating {
  label: string
  customPct?: number | null
  likertValue: number // 1–5
}

export interface VariableContribution {
  label: string
  pctContribution: number
  amountContribution: number
}

export interface TipResult {
  tipPctFinal: number
  tipAmountFinal: number
  perPersonTip: number
  perPersonTotal: number
  perVariableContribution: VariableContribution[]
  formatted: {
    tipAmountFinal: string
    perPersonTip: string
    perPersonTotal: string
  }
}

// Likert 1–5 → weight 0/0.25/0.50/0.75/1.00
const LIKERT_WEIGHT = new Map<number, number>([
  [1, 0.0],
  [2, 0.25],
  [3, 0.5],
  [4, 0.75],
  [5, 1.0],
])

function likertWeight(value: number): number {
  return LIKERT_WEIGHT.get(value) ?? 0
}

export function formatCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function calculateTip(
  settings: TipSettings,
  variables: VariableRating[],
  billAmount: number,
  splitBy = 1,
): TipResult {
  const { maxTipPct, hasFixed, fixedTipPct, variableCalcMethod, currency, roundUp } = settings

  const fixedPct = hasFixed ? fixedTipPct : 0
  const variablePool = maxTipPct - fixedPct

  const perVariableContribution: VariableContribution[] = []
  let totalVariablePct = 0

  if (variables.length > 0 && variablePool > 0) {
    if (variableCalcMethod === 'EQUAL') {
      const sharePerVar = variablePool / variables.length
      for (const v of variables) {
        const pct = sharePerVar * likertWeight(v.likertValue)
        perVariableContribution.push({
          label: v.label,
          pctContribution: pct,
          amountContribution: (billAmount * pct) / 100,
        })
        totalVariablePct += pct
      }
    } else {
      // CUSTOM — customPcts are weights (nominally summing to 100); normalise if they don't
      const weights = variables.map(v => Math.max(0, v.customPct ?? 0))
      const weightSum = weights.reduce((s, w) => s + w, 0)
      for (let i = 0; i < variables.length; i++) {
        const share = weightSum > 0 ? weights[i] / weightSum : 0
        const pct = share * variablePool * likertWeight(variables[i].likertValue)
        perVariableContribution.push({
          label: variables[i].label,
          pctContribution: pct,
          amountContribution: (billAmount * pct) / 100,
        })
        totalVariablePct += pct
      }
    }
  }

  let tipPctFinal = fixedPct + totalVariablePct
  let tipAmountFinal = (billAmount * tipPctFinal) / 100

  if (roundUp && billAmount > 0) {
    const rounded = Math.ceil(tipAmountFinal)
    const maxTipAmount = (billAmount * maxTipPct) / 100
    if (rounded <= maxTipAmount) {
      tipAmountFinal = rounded
      tipPctFinal = (tipAmountFinal / billAmount) * 100
    }
  }

  const perPersonTip = tipAmountFinal / splitBy
  const perPersonTotal = (billAmount + tipAmountFinal) / splitBy

  return {
    tipPctFinal,
    tipAmountFinal,
    perPersonTip,
    perPersonTotal,
    perVariableContribution,
    formatted: {
      tipAmountFinal: formatCurrency(tipAmountFinal, currency),
      perPersonTip: formatCurrency(perPersonTip, currency),
      perPersonTotal: formatCurrency(perPersonTotal, currency),
    },
  }
}
