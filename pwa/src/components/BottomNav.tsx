import { useAppStore } from '../store/appStore'
import type { Page } from '../store/appStore'
import styles from './BottomNav.module.css'

const TABS: { page: Page; icon: string; label: string }[] = [
  { page: 'home',      icon: '🏠', label: 'Home'      },
  { page: 'my-visits', icon: '📋', label: 'My Visits' },
  { page: 'community', icon: '🌐', label: 'Community' },
  { page: 'settings',  icon: '⚙️', label: 'Settings'  },
]

export function BottomNav() {
  const { page, setPage } = useAppStore()

  return (
    <nav className={styles.nav}>
      {TABS.map(tab => (
        <button
          key={tab.page}
          className={`${styles.tab} ${page === tab.page ? styles.tabActive : ''}`}
          onClick={() => setPage(tab.page)}
          aria-label={tab.label}
          aria-current={page === tab.page ? 'page' : undefined}
        >
          <span className={styles.tabIcon}>{tab.icon}</span>
          <span className={styles.tabLabel}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
