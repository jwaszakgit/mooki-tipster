import { useState, useEffect } from 'react'
import { getInstallPrompt, clearInstallPrompt } from '../lib/installPrompt'

export type InstallState = 'android' | 'ios' | 'installed' | 'unsupported'

export interface UseInstallPromptResult {
  installState: InstallState
  promptInstall: () => Promise<void>
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function useInstallPrompt(): UseInstallPromptResult {
  const [hasPrompt, setHasPrompt] = useState(() => getInstallPrompt() !== null)

  useEffect(() => {
    const handler = () => setHasPrompt(true)
    window.addEventListener('pwa:installable', handler)
    return () => window.removeEventListener('pwa:installable', handler)
  }, [])

  let installState: InstallState
  if (isStandalone()) {
    installState = 'installed'
  } else if (hasPrompt) {
    installState = 'android'
  } else if (isIOS()) {
    installState = 'ios'
  } else {
    installState = 'unsupported'
  }

  async function promptInstall(): Promise<void> {
    const prompt = getInstallPrompt()
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      clearInstallPrompt()
      setHasPrompt(false)
    }
  }

  return { installState, promptInstall }
}
