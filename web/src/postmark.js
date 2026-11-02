// The round date stamp from the 1963 and 1964 bonds, inked with real chain data.
const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function dateLine(date = new Date()) {
  const year = String(date.getUTCFullYear()).slice(2);
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${year}`;
}

export function postmarkSvg({ ring, date, middle, foot }) {
  return `
  <svg class="postmark" viewBox="0 0 240 240" role="img" aria-label="${ring}. ${date}. ${middle}. ${foot}">
    <defs>
      <path id="pm-ring" d="M120 120m-84 0a84 84 0 1 1 168 0a84 84 0 1 1-168 0" />
      <filter id="pm-ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.6" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.18" numOctaves="2" seed="9" result="patch" />
        <feColorMatrix in="patch" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.45" result="wear" />
        <feComposite in="rough" in2="wear" operator="in" />
      </filter>
    </defs>
    <g filter="url(#pm-ink)" fill="currentColor" stroke="currentColor">
      <circle cx="120" cy="120" r="112" fill="none" stroke-width="3.4" />
      <circle cx="120" cy="120" r="72" fill="none" stroke-width="2.4" />
      <text class="postmark__ring" stroke="none"><textPath href="#pm-ring" textLength="520">${ring}</textPath></text>
      <text class="postmark__date" x="120" y="94" text-anchor="middle" stroke="none">${date}</text>
      <text class="postmark__middle" x="120" y="128" text-anchor="middle" stroke="none">${middle}</text>
      <text class="postmark__foot" x="120" y="154" text-anchor="middle" stroke="none">${foot}</text>
    </g>
  </svg>`;
}
