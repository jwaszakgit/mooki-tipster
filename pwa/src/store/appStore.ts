import { create } from 'zustand'
import { getLocalData, saveLocalData } from '../services/localStore'

export type Currency = 'USD' | 'GBP' | 'CAD' | 'EUR'
export type VariableCalcMethod = 'EQUAL' | 'CUSTOM'
export type Page = 'home' | 'settings' | 'my-visits' | 'community' | 'recover'

// ── Defaults — change here to update everywhere ─────────────────────────────

export const FIXED_TIP_NICKNAME_DEFAULT = 'Showed up to serve'

export const DEFAULT_VARIABLE_LABELS = [
  'Friendly and Engaging',
  'Order Experience and Results',
  'Pace of Drinks and Food',
  'Bill Delivery, Accuracy, Fees',
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

export interface VisitPayload {
  deviceId: string
  googlePlaceId: string
  restaurantName: string
  address1: string
  address2: string | null
  city: string
  region: string
  postalCode: string
  country: string
  lat: number
  lng: number
  billAmount: number
  currency: Currency
  splitBy: number
  tipPctFinal: number
  tipAmountFinal: number
  variableRatings: Array<{
    labelAtTime: string
    defaultMatchKey: string | null
    likertValue: number
    pctContribution: number
  }>
  supplementalRating?: {
    foodQuality: number
    foodValue: number
    drinkQuality: number
    drinkValue: number
    vibe: number
  }
}

interface AppState {
  deviceId: string | null
  page: Page
  settings: TipSettings
  recoveryEmail: string
  recoveryEmailVerified: boolean

  // Pending visit held locally until email is verified (capture-then-verify)
  pendingVisit: VisitPayload | null

  // Home page session state — persists across settings navigation, not saved to IDB
  billText: string
  likertRatings: Record<string, number>
  splitBy: number

  // Cross-page navigation state
  saveSharePrefill: string | null

  // Last saved visit location — persisted for heartbeat analytics
  lastVisitLatitude: number | null
  lastVisitLongitude: number | null

  initDevice: () => Promise<void>
  setPage: (page: Page) => void
  setSaveSharePrefill: (term: string | null) => void
  updateSettings: (patch: Partial<TipSettings>) => void
  addVariable: () => void
  removeVariable: (id: string) => void
  updateVariable: (id: string, patch: Partial<Pick<TipVariable, 'label' | 'customPct'>>) => void
  reorderVariables: (fromIndex: number, toIndex: number) => void
  resetSettings: () => void
  setRecoveryEmail: (email: string) => void
  setRecoveryEmailVerified: (verified: boolean) => void
  setPendingVisit: (visit: VisitPayload | null) => void
  setDeviceId: (id: string, recoveryEmail?: string) => void
  resyncEmailState: () => Promise<void>
  setBillText: (text: string) => void
  setLikert: (id: string, value: number) => void
  setSplitBy: (n: number) => void
  resetHomeForm: () => void
  setLastVisitLocation: (lat: number | null, lng: number | null) => void
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
    recoveryEmailVerified: state.recoveryEmailVerified,
    pendingVisit: state.pendingVisit,
    lastVisitLatitude: state.lastVisitLatitude,
    lastVisitLongitude: state.lastVisitLongitude,
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  deviceId: null,
  page: 'home',
  settings: makeDefaultSettings(),
  recoveryEmail: '',
  recoveryEmailVerified: false,
  pendingVisit: null,

  billText: '',
  likertRatings: {},
  splitBy: 1,
  saveSharePrefill: null,
  lastVisitLatitude: null,
  lastVisitLongitude: null,

  initDevice: async () => {
    let deviceId = localStorage.getItem('mooki_tipster_device_id')
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('mooki_tipster_device_id', deviceId)
    }

    const data = await getLocalData()
    const persisted = data as Partial<ReturnType<typeof getSerializableState>> | null
    if (persisted) {
      set({
        deviceId,
        settings:              persisted.settings              ?? makeDefaultSettings(),
        recoveryEmail:         persisted.recoveryEmail         ?? '',
        recoveryEmailVerified: persisted.recoveryEmailVerified ?? false,
        pendingVisit:          persisted.pendingVisit          ?? null,
        lastVisitLatitude:     persisted.lastVisitLatitude     ?? null,
        lastVisitLongitude:    persisted.lastVisitLongitude    ?? null,
      })
    } else {
      set({ deviceId })
    }

    // Sync recovery email from server — ensures accuracy across browser sessions
    // where another session may have verified the email. Best-effort: local state
    // stands if the network call fails.
    try {
      const apiUrl = (import.meta as any).env?.VITE_API_URL
      if (apiUrl) {
        const res = await fetch(`${apiUrl}/api/v1/tipster/email/me?deviceId=${deviceId}`)
        if (res.ok) {
          const { verified, email } = await res.json()
          if (verified) {
            const next = {
              recoveryEmailVerified: true,
              ...(email ? { recoveryEmail: email as string } : {}),
            }
            set(next)
            saveLocalData(getSerializableState({ ...get(), ...next }))
          }
        }
      }
    } catch {
      // silent — local state is the fallback
    }
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

  resetSettings: () => {
    const defaults = makeDefaultSettings()
    set({ settings: defaults, recoveryEmail: '', recoveryEmailVerified: false, pendingVisit: null })
    saveLocalData(getSerializableState({
      ...get(),
      settings: defaults,
      recoveryEmail: '',
      recoveryEmailVerified: false,
      pendingVisit: null,
    }))
  },

  // Changing the email resets verification — user must re-verify
  setRecoveryEmail: (email) => {
    const next = { recoveryEmail: email, recoveryEmailVerified: false }
    set(next)
    saveLocalData(getSerializableState({ ...get(), ...next }))
  },

  setRecoveryEmailVerified: (verified) => {
    set({ recoveryEmailVerified: verified })
    saveLocalData(getSerializableState({ ...get(), recoveryEmailVerified: verified }))
  },

  setPendingVisit: (visit) => {
    set({ pendingVisit: visit })
    saveLocalData(getSerializableState({ ...get(), pendingVisit: visit }))
  },

  // Re-reads only email fields from IDB — used for cross-tab sync via storage event
  resyncEmailState: async () => {
    const data = await getLocalData()
    const persisted = data as Partial<ReturnType<typeof getSerializableState>> | null
    if (persisted) {
      set({
        recoveryEmail:         persisted.recoveryEmail         ?? '',
        recoveryEmailVerified: persisted.recoveryEmailVerified ?? false,
      })
    }
  },

  // Used during device recovery — overwrites deviceId in localStorage, store, and IDB.
  // Pass recoveryEmail to set it atomically with verification so they stay consistent.
  setDeviceId: (id, recoveryEmail?) => {
    localStorage.setItem('mooki_tipster_device_id', id)
    const next = {
      deviceId: id,
      recoveryEmailVerified: true,
      ...(recoveryEmail !== undefined ? { recoveryEmail } : {}),
    }
    set(next)
    saveLocalData(getSerializableState({ ...get(), ...next }))
  },

  setSaveSharePrefill: (term) => set({ saveSharePrefill: term }),

  setBillText: (text) => set({ billText: text }),

  setLikert: (id, value) => set(state => ({
    likertRatings: { ...state.likertRatings, [id]: value },
  })),

  setSplitBy: (n) => set({ splitBy: n }),

  resetHomeForm: () => set({ billText: '', likertRatings: {}, splitBy: 1 }),

  setLastVisitLocation: (lat, lng) => {
    set({ lastVisitLatitude: lat, lastVisitLongitude: lng })
    saveLocalData(getSerializableState({ ...get(), lastVisitLatitude: lat, lastVisitLongitude: lng }))
  },
}))
