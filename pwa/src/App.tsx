import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  const { page, initDevice } = useAppStore()

  useEffect(() => {
    initDevice()
  }, [initDevice])

  if (page === 'settings') return <SettingsPage />
  return <HomePage />
}
