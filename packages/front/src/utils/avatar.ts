/**
 * Local avatar generator — replaces api.dicebear.com.
 * Produces a deterministic SVG avatar based on username.
 */

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)));
  };
  return `#${[f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export function generateAvatarUrl(username: string, size = 64): string {
  const h = hashSeed(username);
  const hue = h % 360;
  const bg = hslToHex(hue, 50 + (h % 20), 25 + (h % 15));
  const fg = '#ffffff';
  const initial = username.charAt(0).toUpperCase();
  const fontSize = Math.round(size * 0.45);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="${bg}"/>
  <text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle"
        fill="${fg}" font-family="sans-serif" font-weight="bold"
        font-size="${fontSize}">${initial}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
