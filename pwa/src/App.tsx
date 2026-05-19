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

export default function App() {
  const { page, initDevice } = useAppStore()
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOMED_KEY))

  useEffect(() => {
    initDevice()
  }, [initDevice])

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
