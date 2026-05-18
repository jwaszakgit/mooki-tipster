let _deferredPrompt: any = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  _deferredPrompt = e
  window.dispatchEvent(new Event('pwa:installable'))
})

export function getInstallPrompt(): any {
  return _deferredPrompt
}

export function clearInstallPrompt(): void {
  _deferredPrompt = null
}
