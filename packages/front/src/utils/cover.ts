/**
 * Local gradient cover art generator — replaces picsum.photos.
 * Produces a deterministic SVG data URI based on a seed string.
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

/**
 * Generate a gradient cover art URL.
 * @param seed - A unique string (e.g. song ID) for deterministic output
 * @param width - Width in pixels (default 400)
 * @param height - Height in pixels (default 400)
 * @returns A data URI (SVG) that can be used as src
 */
export function generateCoverUrl(seed: string, width = 400, height = 400): string {
  const h = hashSeed(seed);
  const hue = h % 360;
  const hue2 = (hue + 30 + (h % 60)) % 360;
  const sat = 50 + (h % 30);
  const light = 40 + (h % 20);
  const color1 = hslToHex(hue, sat, light);
  const color2 = hslToHex(hue2, sat, light + 10);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color1}"/>
      <stop offset="100%" style="stop-color:${color2}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
