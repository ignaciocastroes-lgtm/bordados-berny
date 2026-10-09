/**
 * components/garment-icons.tsx
 *
 * Artistic "bordado" icon set for the garment-type picker (wizard step 1).
 * Replaces the plain Lucide/generic outline icons with hand-drawn-feeling
 * garment silhouettes that carry the same embroidery motif as the brand
 * mark (components/logo-bordados-berny.tsx): a dashed stitch line tracing
 * a seam, plus a small french-knot dot or needle accent. Every icon uses
 * `currentColor` for both stroke and accent fill/opacity, so it still
 * inherits the card's selected/unselected color via Tailwind text-* classes.
 */

type IconProps = { className?: string }

/** Shared french-knot accent — a tiny filled dot standing in for a single
 *  embroidery stitch, dropped near the "working point" of each garment. */
function Knot({ cx, cy }: { cx: number; cy: number }) {
  return <circle cx={cx} cy={cy} r="1.1" fill="currentColor" />
}

export function PantsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 3.5h15l.6 3.2-2 15.3h-3.6l-1.6-11-1.6 11H7.7l-2-15.3.8-3.2z" strokeWidth="1.5" />
      <path d="M4.9 6.7h14.2" strokeWidth="1.1" strokeDasharray="1.6 1.6" opacity="0.6" />
      <Knot cx={12} cy={5.1} />
    </svg>
  )
}

export function ShortsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 3.5h15l.5 3.5-1.3 9.3h-3.4l-1-6.3-1 6.3h-3.4l-1.3-9.3.9-3.5z" strokeWidth="1.5" />
      <path d="M4.9 6.6h14.2" strokeWidth="1.1" strokeDasharray="1.6 1.6" opacity="0.6" />
      <Knot cx={12} cy={5.1} />
    </svg>
  )
}

export function BlouseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 3.2c1 1 2.3 1.5 3.5 1.5s2.5-.5 3.5-1.5l3 2 -1 3.2-2-.7v10.3a1 1 0 01-1 1h-5a1 1 0 01-1-1V7.7l-2 .7-1-3.2 3-2z" strokeWidth="1.5" />
      <path d="M9.6 4.1a3.4 3.4 0 004.8 0" strokeWidth="1.1" strokeDasharray="1.3 1.4" opacity="0.6" />
      <Knot cx={12} cy={9.5} />
    </svg>
  )
}

export function TShirtIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.3 2.6L12 4l3.7-1.4 4 2.1-1.5 3.3-2.1-.8v10.4a1 1 0 01-1 1H9a1 1 0 01-1-1V7.2l-2.1.8-1.5-3.3 3.9-2.1z" strokeWidth="1.5" />
      <path d="M9.4 3.4a2.9 2.9 0 005.2 0" strokeWidth="1.1" strokeDasharray="1.3 1.4" opacity="0.6" />
      <Knot cx={12} cy={10} />
    </svg>
  )
}

export function HoodieIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.3 2.6L12 4l3.7-1.4 4 2.1-1.5 3.3-2.1-.8v10.4a1 1 0 01-1 1H9a1 1 0 01-1-1V7.2l-2.1.8-1.5-3.3 3.9-2.1z" strokeWidth="1.5" />
      <path d="M9 3.6c0 2.3 1.3 3.6 3 3.6s3-1.3 3-3.6" strokeWidth="1.3" opacity="0.85" />
      <path d="M9.5 13.5h5" strokeWidth="1.1" strokeDasharray="1.3 1.4" opacity="0.6" />
      <Knot cx={12} cy={13.5} />
    </svg>
  )
}

export function OtherIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="7.5" r="2" strokeWidth="1.5" />
      <circle cx="6.5" cy="16.5" r="2" strokeWidth="1.5" />
      <path d="M8 8.8l11.5 11.2M19.5 3.2L10.8 11.7M8 15.2l2.2-2.1" strokeWidth="1.5" />
      <path d="M12.3 10.2l3.2 3.1" strokeWidth="1.1" strokeDasharray="1.2 1.4" opacity="0.6" />
    </svg>
  )
}

/** Bordado/Matriz — an embroidery hoop with the needle mid-stitch, so this
 *  option reads as "digitizing/embroidery" at a glance rather than a
 *  generic pen. */
export function EmbroideryHoopIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11.5" cy="12" r="8.2" strokeWidth="1.5" />
      <circle cx="11.5" cy="12" r="5.6" strokeWidth="1.1" strokeDasharray="1.6 1.6" opacity="0.65" />
      <path d="M16.8 6.2l4.3-3.4" strokeWidth="1.6" />
      <ellipse cx="21.6" cy="2.3" rx="1.7" ry="0.95" transform="rotate(38 21.6 2.3)" fill="currentColor" stroke="none" opacity="0.9" />
      <Knot cx={11.5} cy={12} />
    </svg>
  )
}
