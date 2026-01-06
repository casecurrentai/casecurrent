export function GuillochePattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.03 }}
    >
      <defs>
        <pattern
          id="guilloche-pattern"
          x="0"
          y="0"
          width="100"
          height="100"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0,50 Q25,0 50,50 T100,50"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <path
            d="M0,50 Q25,100 50,50 T100,50"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="0.3" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.3" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#guilloche-pattern)" />
    </svg>
  );
}

export function DotGridPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.04 }}
    >
      <defs>
        <pattern
          id="dot-grid"
          x="0"
          y="0"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  );
}
