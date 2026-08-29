/**
 * The football environment the whole site sits on.
 *
 * A floodlit pitch at night: markings drawn as one SVG, a slow light sweep,
 * and a vignette so foreground panels stay readable over it. It is fixed,
 * decorative and inert -- `aria-hidden`, no pointer events, no layout cost,
 * and it never scrolls with the content.
 *
 * Rendered once in the public layout rather than per page, so navigating
 * between pages does not restart the animation.
 */
export function PitchBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      {/* Turf: alternating mow stripes, the way a ground is cut. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(115deg, #0e1b13 0 78px, #0a1410 78px 156px)',
        }}
      />

      {/* Pitch markings, drawn to the real proportions of a small-sided pitch. */}
      <svg
        className="absolute left-1/2 top-1/2 h-[125%] w-[190%] -translate-x-1/2 -translate-y-1/2 sm:w-[135%] lg:w-[105%]"
        viewBox="0 0 1200 800"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="#7dffab" strokeOpacity="0.13" strokeWidth="2.5">
          {/* touchlines */}
          <rect x="60" y="50" width="1080" height="700" rx="4" />
          {/* halfway line + centre circle */}
          <line x1="600" y1="50" x2="600" y2="750" />
          <circle cx="600" cy="400" r="115" />
          <circle cx="600" cy="400" r="6" fill="#7dffab" fillOpacity="0.2" stroke="none" />
          {/* penalty areas */}
          <rect x="60" y="230" width="150" height="340" />
          <rect x="990" y="230" width="150" height="340" />
          {/* six yard boxes */}
          <rect x="60" y="320" width="62" height="160" />
          <rect x="1078" y="320" width="62" height="160" />
          {/* penalty arcs */}
          <path d="M210 330 A 95 95 0 0 1 210 470" />
          <path d="M990 330 A 95 95 0 0 0 990 470" />
          {/* corner arcs */}
          <path d="M60 78 A 28 28 0 0 0 88 50" />
          <path d="M1140 78 A 28 28 0 0 1 1112 50" />
          <path d="M60 722 A 28 28 0 0 1 88 750" />
          <path d="M1140 722 A 28 28 0 0 0 1112 750" />
        </g>
      </svg>

      {/* Floodlight sweeping across the ground. */}
      <div
        className="animate-floodlight absolute -top-1/3 left-1/4 h-[160%] w-[45%] blur-3xl"
        style={{
          background:
            'linear-gradient(180deg, rgba(125,255,171,0.16) 0%, rgba(46,232,106,0.05) 45%, transparent 78%)',
        }}
      />

      {/* Vignette: keeps the middle of the screen calm behind content. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(135% 95% at 50% 12%, rgba(6,12,8,0.10) 0%, rgba(6,12,8,0.55) 52%, rgba(6,12,8,0.9) 100%)',
        }}
      />
    </div>
  );
}

/**
 * A football, as an inline SVG. Used at small sizes as an ornament and at
 * larger sizes inside empty states, where it drifts gently.
 */
export function Football({
  size = 24,
  className = '',
  drift = false,
}: {
  size?: number;
  className?: string;
  drift?: boolean;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`${drift ? 'animate-drift' : ''} ${className}`}
    >
      <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.1" />
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2.5" fill="none" />
      {/* central pentagon */}
      <path
        d="M32 16 L44 25 L39.5 39 L24.5 39 L20 25 Z"
        fill="currentColor"
        fillOpacity="0.55"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* seams reaching the edge */}
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M32 16 L32 4" />
        <path d="M44 25 L56 20" />
        <path d="M39.5 39 L47 51" />
        <path d="M24.5 39 L17 51" />
        <path d="M20 25 L8 20" />
      </g>
    </svg>
  );
}
