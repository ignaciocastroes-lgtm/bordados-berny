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
      <defs>
        <radialGradient id="bb-mark-grad" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="55%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bb-mark-grad)" />
      <circle cx="50" cy="50" r="48" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" fill="none" opacity="0.5" />
      {/* a few loose stitch marks tracing the inner rim — embroidery-hoop detail */}
      <circle cx="50" cy="50" r="40" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="1.2 5" fill="none" opacity="0.35" />
      {/* needle forming the spine */}
      <path d="M32 68 L64 22" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="60" cy="28" rx="2" ry="4.8" transform="rotate(26 60 28)" fill="#047857" stroke="#FFFFFF" strokeWidth="1.5" />
      {/* small highlight on the needle eye for a hand-finished, dimensional feel */}
      <ellipse cx="59.2" cy="26.6" rx="0.6" ry="1.6" transform="rotate(26 59.2 26.6)" fill="#FFFFFF" opacity="0.8" />
      {/* thread forming the "B" bowls */}
      <path
        d="M40 40 C52 30, 70 36, 62 50 C58 57, 48 57, 44 57 C62 57, 74 65, 62 76 C52 85, 36 80, 36 68"
        stroke="#FFFFFF"
        strokeWidth="2.75"
        strokeLinecap="round"
        fill="none"
        opacity="0.92"
      />
      {/* trailing thread tail + french knot, like a finished stitch */}
      <path d="M36 68 C33 71, 31 73, 29 73.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.8" />
      <circle cx="28.3" cy="73.7" r="1.6" fill="#FFFFFF" opacity="0.85" />
    </svg>
  )
}

/** Full lockup with wordmark — for headers with room (login heading,
 *  a document header, the marketing-site style usage). */
export function LogoFull({ className = "h-12 w-auto" }: LogoProps) {
  return (
    <svg viewBox="0 0 260 72" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bb-full-grad" cx="35%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="55%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
        <linearGradient id="bb-full-text-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r="32" fill="url(#bb-full-grad)" />
      <circle cx="36" cy="36" r="32" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 4" fill="none" opacity="0.4" />
      <path d="M21 50 L50 14" stroke="#FFFFFF" strokeWidth="2.75" strokeLinecap="round" />
      <ellipse cx="47" cy="19" rx="1.6" ry="3.8" transform="rotate(26 47 19)" fill="#047857" stroke="#FFFFFF" strokeWidth="1.2" />
      <path
        d="M28 29 C37 22, 50 26, 44 36 C41 41, 33 41, 30 41 C44 41, 53 47, 44 55 C37 61, 25 58, 25 49"
        stroke="#FFFFFF"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.92"
      />
      <path d="M25 49 C23 51.5, 21.5 52.8, 20 53.2" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.75" />
      <circle cx="19.3" cy="53.4" r="1.3" fill="#FFFFFF" opacity="0.8" />
      <text x="80" y="32" fill="#1C1917" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="19" letterSpacing="0.3">
        Bordados Berny
      </text>
      <text x="80" y="50" fill="url(#bb-full-text-grad)" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="10.5" letterSpacing="2">
        TALLER TEXTIL 4.0
      </text>
    </svg>
  )
}
