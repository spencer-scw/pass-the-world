// Generates public/backdrop.svg (an original dusk landscape in flat layers): node scripts/backdrop.mjs public/backdrop.svg
import { writeFileSync } from 'node:fs';
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const W = 1600,
  H = 1000;

// Ridge line through jittered peaks, closed down to the bottom edge.
function ridge(base, amp, peaks, rough) {
  const pts = [];
  const step = W / peaks;
  for (let i = -1; i <= peaks + 1; i++) {
    const x = i * step + (rand() - 0.5) * step * 0.4;
    const peak = base - amp * (0.5 + rand() * 0.5);
    pts.push([x - step * 0.5, base - amp * 0.15 * rand()]);
    // a few shoulders on the way up for a craggier silhouette
    for (let k = 1; k <= rough; k++) {
      const t = k / (rough + 1);
      pts.push([x - step * 0.5 * (1 - t), peak + (base - peak) * (1 - t) * (0.8 + rand() * 0.3)]);
    }
    pts.push([x, peak]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  return `M${-50},${H} ` + pts.map(([x, y]) => `L${x.toFixed(0)},${y.toFixed(0)}`).join(' ') + ` L${W + 50},${H} Z`;
}

// Smooth rolling hill.
function hill(base, amp, waves) {
  let d = `M-50,${H} L-50,${base}`;
  const step = (W + 100) / waves;
  for (let i = 0; i < waves; i++) {
    const x0 = -50 + i * step;
    const y = base - amp * (0.3 + rand() * 0.7);
    d += ` Q${(x0 + step / 2).toFixed(0)},${y.toFixed(0)} ${(x0 + step).toFixed(0)},${(base - amp * 0.2 * rand()).toFixed(0)}`;
  }
  return d + ` L${W + 50},${H} Z`;
}

// Pine: stacked, slightly ragged tiers on a short trunk.
function pine(x, y, h) {
  const w = h * 0.42;
  const tiers = 5;
  let d = '';
  for (let i = 0; i < tiers; i++) {
    const top = y - h + (h * 0.85 * i) / tiers;
    const bot = top + h * 0.34;
    const half = (w / 2) * (0.35 + (0.65 * (i + 1)) / tiers);
    d += `M${x.toFixed(1)},${top.toFixed(1)} L${(x + half).toFixed(1)},${bot.toFixed(1)} L${(x - half).toFixed(1)},${bot.toFixed(1)} Z `;
  }
  d += `M${(x - h * 0.03).toFixed(1)},${(y - h * 0.15).toFixed(1)} h${(h * 0.06).toFixed(1)} v${(h * 0.15).toFixed(1)} h${(-h * 0.06).toFixed(1)} Z`;
  return d;
}
function forest(count, yMin, yMax, hMin, hMax) {
  const trees = Array.from({ length: count }, () => {
    const y = yMin + rand() * (yMax - yMin);
    return [rand() * W, y, hMin + ((y - yMin) / (yMax - yMin || 1)) * (hMax - hMin) * (0.7 + rand() * 0.6)];
  }).sort((a, b) => a[1] - b[1]);
  return trees.map(([x, y, h]) => pine(x, y, h)).join(' ');
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3f4590"/>
      <stop offset="0.45" stop-color="#5a62a6"/>
      <stop offset="0.75" stop-color="#7d8fb8"/>
    </linearGradient>
    <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9fb4c4" stop-opacity="0"/>
      <stop offset="1" stop-color="#9fb4c4" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <path d="${ridge(470, 260, 5, 3)}" fill="#8aa3b3"/>
  <path d="${ridge(560, 220, 7, 2)}" fill="#6f8f98"/>
  <rect y="300" width="${W}" height="400" fill="url(#haze)"/>
  <path d="${hill(640, 90, 6)}" fill="#557a79"/>
  <path d="${forest(70, 600, 690, 30, 55)}" fill="#3f6460"/>
  <path d="${hill(730, 80, 5)}" fill="#4a7062"/>
  <path d="${forest(40, 700, 790, 60, 110)}" fill="#33594d"/>
  <path d="${hill(820, 70, 4)}" fill="#46694a"/>
  <path d="${forest(12, 800, 900, 160, 300)}" fill="#284a37"/>
  <path d="${hill(920, 50, 3)}" fill="#3c5b3c"/>
</svg>
`;
writeFileSync(process.argv[2], svg);
console.log(svg.length, 'bytes');
