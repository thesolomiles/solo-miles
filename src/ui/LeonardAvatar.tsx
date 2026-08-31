/**
 * A little illustrated portrait of Leonard for the ride speech box — flat,
 * low-poly-friendly shapes matching his in-game look (blue cap, warm skin, blue
 * jersey). Self-contained inline SVG so it travels with the build, no asset file.
 */
export function LeonardAvatar({ size = 76 }: { size?: number }) {
  return (
    <svg
      className="ride-avatar"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-label="Leonard"
      role="img"
    >
      <defs>
        <clipPath id="lav-clip">
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>
      {/* framed disc */}
      <circle cx="50" cy="50" r="48" fill="#2b2620" />
      <circle cx="50" cy="50" r="46" fill="#f3e3c4" />
      <g clipPath="url(#lav-clip)">
        {/* sky-ish backdrop */}
        <rect x="0" y="0" width="100" height="100" fill="#cfe6ec" />
        <rect x="0" y="62" width="100" height="38" fill="#a9cf8f" />
        {/* jersey shoulders */}
        <path d="M18 100 Q22 74 50 74 Q78 74 82 100 Z" fill="#3a63a6" />
        <path d="M42 74 h16 v8 q-8 6 -16 0 Z" fill="#2f5188" />
        {/* neck */}
        <rect x="43" y="66" width="14" height="12" rx="4" fill="#d9a074" />
        {/* head */}
        <ellipse cx="50" cy="50" rx="21" ry="23" fill="#e6b78f" />
        {/* ears */}
        <circle cx="29" cy="51" r="4.2" fill="#e6b78f" />
        <circle cx="71" cy="51" r="4.2" fill="#e6b78f" />
        {/* jaw stubble hint */}
        <path d="M33 55 Q50 74 67 55 Q64 66 50 68 Q36 66 33 55 Z" fill="#d29c72" opacity="0.55" />
        {/* brows + eyes */}
        <rect x="38" y="46" width="8" height="2.4" rx="1.2" fill="#3b2c22" />
        <rect x="54" y="46" width="8" height="2.4" rx="1.2" fill="#3b2c22" />
        <circle cx="42" cy="52" r="2.4" fill="#33261d" />
        <circle cx="58" cy="52" r="2.4" fill="#33261d" />
        {/* nose + smile */}
        <path d="M50 53 l-2.4 6 h4.8 Z" fill="#d29c72" />
        <path d="M43 63 Q50 68 57 63" stroke="#a5673f" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* cap dome + brim */}
        <path d="M27 44 Q30 22 50 22 Q70 22 73 44 Q50 37 27 44 Z" fill="#3570c4" />
        <path d="M27 44 Q50 37 73 44 L74 47 Q50 41 26 47 Z" fill="#2b5ba6" />
        <path d="M26 47 Q40 45 40 45 Q30 52 22 54 Q22 47 26 47 Z" fill="#2b5ba6" />
        <circle cx="50" cy="26" r="2.6" fill="#2b5ba6" />
      </g>
    </svg>
  )
}
