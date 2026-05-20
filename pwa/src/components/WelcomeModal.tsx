import { useState } from 'react'
import styles from './WelcomeModal.module.css'

interface Props {
  onAccept: () => void
}

export function WelcomeModal({ onAccept }: Props) {
  const [agreed, setAgreed] = useState(false)

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.logo}>
          <img src="/icons/icon-192.png" width="56" height="56" style={{ borderRadius: 14 }} alt="mooki Tipster" />
          <div className={styles.logoWord}>
            <span className={styles.logoM}>m</span>
            <span className={styles.logoRest}>ooki Tipster</span>
          </div>
        </div>

        <p className={styles.body}>
          Tipster objectively answers the question, "What should I put for a tip?". Track your experiences over time and tap into the community for consistent restaurant ratings.
        </p>

        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
          />
          <span>
            I agree to the{' '}
            <a href="https://www.mooki-apps.com/terms" target="_blank" rel="noopener noreferrer" className={styles.link}>
              Terms of Service
            </a>
            {' '}and{' '}
            <a href="https://www.mooki-apps.com/privacy" target="_blank" rel="noopener noreferrer" className={styles.link}>
              Privacy Policy
            </a>
          </span>
        </label>

        <p className={styles.once}>You'll only see this once.</p>

        <button className={styles.button} onClick={onAccept} disabled={!agreed}>
          Let's go →
        </button>
      </div>
    </div>
  )
}
