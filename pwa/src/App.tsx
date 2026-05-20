import { useEffect, useState } from 'react'
import { useAppStore } from './store/appStore'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'
import { MyVisitsPage } from './pages/MyVisitsPage'
import { CommunityPage } from './pages/CommunityPage'
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
  const { page, initDevice } = useAppStore()
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOMED_KEY))

  useEffect(() => {
    initDevice().then(() => {
      sendHeartbeatIfNeeded()
    })
  }, [])

  function handleAccept() {
    localStorage.setItem(WELCOMED_KEY, '1')
    setShowWelcome(false)
  }

  return (
    <div className={styles.shell}>
      <div className={styles.pageSlot}>
        {page === 'home'       && <HomePage />}
        {page === 'settings'   && <SettingsPage />}
        {page === 'my-visits'  && <MyVisitsPage />}
        {page === 'community'  && <CommunityPage />}
      </div>
      <BottomNav />
      {showWelcome && <WelcomeModal onAccept={handleAccept} />}
    </div>
  )
}
