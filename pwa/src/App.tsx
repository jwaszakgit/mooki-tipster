import { useEffect, useState } from 'react'
import { useAppStore } from './store/appStore'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'
import { WelcomeModal } from './components/WelcomeModal'

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
    <>
      {page === 'settings' ? <SettingsPage /> : <HomePage />}
      {showWelcome && <WelcomeModal onAccept={handleAccept} />}
    </>
  )
}
