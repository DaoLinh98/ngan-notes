/**
 * The 22px countdown ring beside a TOTP code. Track circle plus an accent arc
 * whose dash length is the fraction of the window still left.
 */
export function TotpRing({ remaining, total }: { remaining: number; total: number }) {
  const r = 9;
  const circumference = 2 * Math.PI * r;
  const left = circumference * Math.max(0, Math.min(1, remaining / total));

  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true" className="totp-ring">
      <circle cx="12" cy="12" r={r} fill="none" stroke="var(--border-strong)" strokeWidth={3} />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={3}
        strokeDasharray={`${left} ${circumference}`}
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}
