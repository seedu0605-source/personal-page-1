import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.brand}>LEE SEUNGHYEOK</span>

        <nav className={styles.nav}>
          <a className={styles.link} href="#work">
            WORK
          </a>
          <a className={styles.link} href="#about">
            ABOUT
          </a>
          <a className={styles.link} href="#contact">
            CONTACT
          </a>

          <button className={styles.menu} type="button" aria-label="Open menu">
            <span />
            <span />
          </button>
        </nav>
      </div>
    </header>
  )
}
