import { create } from 'zustand'
import { getLocalData, saveLocalData } from '../services/localStore'

export type Currency = 'USD' | 'GBP' | 'CAD' | 'EUR'
export type VariableCalcMethod = 'EQUAL' | 'CUSTOM'
export type Page = 'home' | 'settings'

// ── Defaults — change here to update everywhere ─────────────────────────────

export const FIXED_TIP_NICKNAME_DEFAULT = 'Showed up to serve'

export const DEFAULT_VARIABLE_LABELS = [
  'Friendly and Engaging',
  'Order Experience and Results',
  'Pace of Drinks and Food',
  'Bill Delivery and Accuracy',
] as const

// ── Types ───────────────────────────────────────────────────────────────────

export interface TipVariable {
  id: string
  label: string
  sortOrder: number
  customPct: number | null
}

export interface TipSettings {
  currency: Currency
  maxTipPct: number
  hasFixed: boolean
  fixedTipPct: number
  fixedTipNickname: string
  roundUp: boolean
  variableCalcMethod: VariableCalcMethod
  variables: TipVariable[]
}

interface AppState {
  deviceId: string | null
  page: Page
  settings: TipSettings
  recoveryEmail: string

  // Home page session state — persists across settings navigation, not saved to IDB
  billText: string
  likertRatings: Record<string, number>
  splitBy: number

  initDevice: () => void
  setPage: (page: Page) => void
  updateSettings: (patch: Partial<TipSettings>) => void
  addVariable: () => void
  removeVariable: (id: string) => void
  updateVariable: (id: string, patch: Partial<Pick<TipVariable, 'label' | 'customPct'>>) => void
  reorderVariables: (fromIndex: number, toIndex: number) => void
  setRecoveryEmail: (email: string) => void
  setBillText: (text: string) => void
  setLikert: (id: string, value: number) => void
  setSplitBy: (n: number) => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeDefaultVariables(): TipVariable[] {
  return DEFAULT_VARIABLE_LABELS.map((label, i) => ({
    id: crypto.randomUUID(),
    label,
    sortOrder: i,
    customPct: null,
  }))
}

function makeDefaultSettings(): TipSettings {
  return {
    currency: 'USD',
    maxTipPct: 25,
    hasFixed: true,
    fixedTipPct: 10,
    fixedTipNickname: FIXED_TIP_NICKNAME_DEFAULT,
    roundUp: false,
    variableCalcMethod: 'EQUAL',
    variables: makeDefaultVariables(),
  }
}

function getSerializableState(state: AppState) {
  return {
    deviceId: state.deviceId,
    settings: state.settings,
    recoveryEmail: state.recoveryEmail,
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  deviceId: null,
  page: 'home',
  settings: makeDefaultSettings(),
  recoveryEmail: '',

  billText: '',
  likertRatings: {},
  splitBy: 1,

  initDevice: () => {
    let deviceId = localStorage.getItem('mooki_tipster_device_id')
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('mooki_tipster_device_id', deviceId)
    }
    getLocalData().then(data => {
      const persisted = data as Partial<ReturnType<typeof getSerializableState>> | null
      if (persisted) {
        set({
          deviceId,
          settings: persisted.settings ?? makeDefaultSettings(),
          recoveryEmail: persisted.recoveryEmail ?? '',
        })
      } else {
        set({ deviceId })
      }
    })
  },

  setPage: (page) => set({ page }),

  updateSettings: (patch) => {
    const current = get().settings
    let settings = { ...current, ...patch }
    if (settings.fixedTipPct > settings.maxTipPct) {
      settings = { ...settings, fixedTipPct: settings.maxTipPct }
    }
    set({ settings })
    saveLocalData(getSerializableState({ ...get(), settings }))
  },

  addVariable: () => {
    const { settings } = get()
    if (settings.variables.length >= 7) return
    const variables: TipVariable[] = [
      ...settings.variables,
      { id: crypto.randomUUID(), label: '', sortOrder: settings.variables.length, customPct: null },
    ]
    const updated = { ...settings, variables }
    set({ settings: updated })
    saveLocalData(getSerializableState({ ...get(), settings: updated }))
  },

  removeVariable: (id) => {
    const { settings } = get()
    const variables = settings.variables
      .filter(v => v.id !== id)
      .map((v, i) => ({ ...v, sortOrder: i }))
    const updated = { ...settings, variables }
    set({ settings: updated })
    saveLocalData(getSerializableState({ ...get(), settings: updated }))
  },

  updateVariable: (id, patch) => {
    const { settings } = get()
    const variables = settings.variables.map(v => v.id === id ? { ...v, ...patch } : v)
    const updated = { ...settings, variables }
    set({ settings: updated })
    saveLocalData(getSerializableState({ ...get(), settings: updated }))
  },

  reorderVariables: (fromIndex, toIndex) => {
    const { settings } = get()
    const vars = [...settings.variables]
    const [moved] = vars.splice(fromIndex, 1)
    vars.splice(toIndex, 0, moved)
    const variables = vars.map((v, i) => ({ ...v, sortOrder: i }))
    const updated = { ...settings, variables }
    set({ settings: updated })
    saveLocalData(getSerializableState({ ...get(), settings: updated }))
  },

  setRecoveryEmail: (email) => {
    set({ recoveryEmail: email })
    saveLocalData(getSerializableState({ ...get(), recoveryEmail: email }))
  },

  setBillText: (text) => set({ billText: text }),

  setLikert: (id, value) => set(state => ({
    likertRatings: { ...state.likertRatings, [id]: value },
  })),

  setSplitBy: (n) => set({ splitBy: n }),
}))
