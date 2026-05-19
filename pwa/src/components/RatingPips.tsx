import styles from './RatingPips.module.css'

interface Props {
  value: number | null | undefined
  max?: number
}

export function RatingPips({ value, max = 5 }: Props) {
  if (value == null) return null
  const filled = Math.round(Math.max(0, Math.min(max, value)))
  return (
    <div className={styles.row}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`${styles.pip} ${i < filled ? styles.pipFilled : ''}`} />
      ))}
    </div>
  )
}
