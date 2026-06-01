import { useEffect, useState } from 'react'
import { useAppStore } from './store/appStore'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'
import { MyVisitsPage } from './pages/MyVisitsPage'
import { CommunityPage } from './pages/CommunityPage'
import { EmailVerifyPage } from './pages/EmailVerifyPage'
import { RecoverPage } from './pages/RecoverPage'
import { BottomNav } from './components/BottomNav'
import { WelcomeModal } from './components/WelcomeModal'
import styles from './App.module.css'

const WELCOMED_KEY = 'mooki_tipster_welcomed'
const HEARTBEAT_KEY = 'mooki_last_heartbeat_tipster'

async function sendHeartbeatIfNeeded() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(HEARTBEAT_KEY) === today) return

    const { deviceId, lastVisitLatitude, lastVisitLongitude } = useAppStore.getState()

    let latitudeRounded: number | null = null
    let longitudeRounded: number | null = null
    if (lastVisitLatitude !== null && lastVisitLongitude !== null) {
      latitudeRounded = Math.round(lastVisitLatitude * 100) / 100
      longitudeRounded = Math.round(lastVisitLongitude * 100) / 100
    }

    const res = await fetch(`${import.meta.env.VITE_API_URL}/heartbeat_tipster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, appSlug: 'tipster', latitudeRounded, longitudeRounded }),
    })

    if (res.ok) {
      localStorage.setItem(HEARTBEAT_KEY, today)
    }
  } catch {
    // silent fail — analytics must never affect the user experience
  }
}

export default function App() {
  const { page, setPage, initDevice, resyncEmailState } = useAppStore()
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOMED_KEY))

  useEffect(() => {
    initDevice().then(() => {
      // Route to deep-link pages when the app is opened via a magic link
      const path = window.location.pathname
      if (path === '/email-verify') setPage('email-verify')
      else if (path === '/recover') setPage('recover')
      sendHeartbeatIfNeeded()
    })

    // Cross-tab sync: when another tab in the same browser verifies the email,
    // re-read the email fields from IDB so this tab reflects the new state.
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'mooki_tipster_email_verified') resyncEmailState()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  function handleAccept() {
    localStorage.setItem(WELCOMED_KEY, '1')
    setShowWelcome(false)
  }

  const isDeepLink = page === 'email-verify' || page === 'recover'

  return (
    <div className={styles.shell}>
      <div className={styles.pageSlot}>
        {page === 'home'         && <HomePage />}
        {page === 'settings'     && <SettingsPage />}
        {page === 'my-visits'    && <MyVisitsPage />}
        {page === 'community'    && <CommunityPage />}
        {page === 'email-verify' && <EmailVerifyPage />}
        {page === 'recover'      && <RecoverPage />}
      </div>
      {!isDeepLink && <BottomNav />}
      {showWelcome && !isDeepLink && <WelcomeModal onAccept={handleAccept} />}
    </div>
  )
}
