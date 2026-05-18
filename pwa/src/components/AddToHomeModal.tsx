import styles from './AddToHomeModal.module.css'

interface Props {
  onClose: () => void
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3M8 7l4-4 4 4" />
      <path d="M4 14v5a1 1 0 001 1h14a1 1 0 001-1v-5" />
    </svg>
  )
}

function AddHomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

export function AddToHomeModal({ onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Add to Home Screen</h2>
        <p className={styles.subtitle}>Open this page in Safari, then follow these steps:</p>

        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepIcon}>
              <ShareIcon />
            </div>
            <div className={styles.stepText}>
              <span className={styles.stepLabel}>Tap the Share button</span>
              <span className={styles.stepDetail}>at the bottom of Safari</span>
            </div>
          </div>

          <div className={styles.stepDivider} />

          <div className={styles.step}>
            <div className={styles.stepIcon}>
              <AddHomeIcon />
            </div>
            <div className={styles.stepText}>
              <span className={styles.stepLabel}>Tap "Add to Home Screen"</span>
              <span className={styles.stepDetail}>scroll down in the share sheet</span>
            </div>
          </div>

          <div className={styles.stepDivider} />

          <div className={styles.step}>
            <div className={styles.stepBadge}>Add</div>
            <div className={styles.stepText}>
              <span className={styles.stepLabel}>Tap Add to confirm</span>
              <span className={styles.stepDetail}>top right corner of the screen</span>
            </div>
          </div>
        </div>

        <button className={styles.button} onClick={onClose}>Got it</button>
      </div>
    </div>
  )
}
