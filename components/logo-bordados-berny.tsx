/**
 * components/logo-bordados-berny.tsx
 *
 * The real Bordados Berny brand mark — replaces the generic Lucide
 * "needle" icon and the plain-text "BB" badge that were standing in for
 * a logo across the app (login screen, admin sidebar). Built as an SVG
 * so it's crisp at any size and themeable via `currentColor` where it
 * matters. Uses the app's existing emerald palette so it drops into
 * both screens without a color-scheme change.
 */

type LogoProps = { className?: string }

/** Compact circular monogram — the needle forms the spine of the "B",
 *  dashed stitch ring, for small slots: login avatar, sidebar icon,
 *  favicon-sized spots (≥32px). */
export function LogoMark({ className = "size-10" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="#059669" />
      <circle cx="50" cy="50" r="48" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" fill="none" opacity="0.5" />
      {/* needle forming the spine */}
      <path d="M34 66 L62 24" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="58" cy="30" rx="2" ry="4.5" transform="rotate(26 58 30)" fill="#059669" stroke="#FFFFFF" strokeWidth="1.5" />
      {/* thread forming the "B" bowls */}
      <path
        d="M40 40 C52 30, 70 36, 62 50 C58 57, 48 57, 44 57 C62 57, 74 65, 62 76 C52 85, 36 80, 36 68"
        stroke="#FFFFFF"
        strokeWidth="2.75"
        strokeLinecap="round"
        fill="none"
        opacity="0.92"
      />
    </svg>
  )
}

/** Full lockup with wordmark — for headers with room (login heading,
 *  a document header, the marketing-site style usage). */
export function LogoFull({ className = "h-12 w-auto" }: LogoProps) {
  return (
    <svg viewBox="0 0 260 72" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="36" cy="36" r="32" fill="#059669" />
      <path d="M22 48 L48 16" stroke="#FFFFFF" strokeWidth="2.75" strokeLinecap="round" />
      <ellipse cx="45" cy="21" rx="1.6" ry="3.5" transform="rotate(26 45 21)" fill="#059669" stroke="#FFFFFF" strokeWidth="1.2" />
      <path
        d="M28 29 C37 22, 50 26, 44 36 C41 41, 33 41, 30 41 C44 41, 53 47, 44 55 C37 61, 25 58, 25 49"
        stroke="#FFFFFF"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.92"
      />
      <text x="80" y="32" fill="#1C1917" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="19" letterSpacing="0.3">
        Bordados Berny
      </text>
      <text x="80" y="50" fill="#059669" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="10.5" letterSpacing="2">
        TALLER TEXTIL 4.0
      </text>
    </svg>
  )
}
