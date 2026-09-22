/**
 * Renders the Eimaste Cool Training app icons into public/icons/.
 *
 *   NODE_PATH=$(npm root -g) node scripts/make-icons.mjs
 *
 * Uses the globally installed `playwright` (not a project dependency) to rasterise the SVG.
 * The mark is the "EC" monogram (Sofia Sans Extra Condensed Black Italic outlines, volt E + white C)
 * on the Night Session background. Keep MARK_E / MARK_C in sync with src/app/Brand.tsx.
 *
 * Outputs:
 *   icon.svg               rounded-square favicon / scalable icon
 *   icon-192.png           "any" purpose, rounded square with transparent corners
 *   icon-512.png           "any" purpose, rounded square with transparent corners
 *   icon-maskable-512.png  full-bleed; the monogram sits well inside the 80% safe zone
 *   apple-touch-icon.png   180x180, full-bleed and opaque (iOS applies its own mask)
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'icons')

/* Glyph outlines in a 64x64 box (cap height 32, centred). */
export const MARK_E =
  'M12.32 47.71Q11.58 47.71 11.71 47.04L16.51 16.96Q16.65 16.29 17.19 16.29H31.55Q32.26 16.29 32.13 16.96L31.35 21.9Q31.25 22.56 30.68 22.56H22.53L21.55 28.88H28.79Q29.5 28.88 29.37 29.54L28.64 34.19Q28.54 34.85 27.97 34.85H20.6L19.56 41.44H27.55Q28.26 41.44 28.16 42.11L27.35 47.04Q27.27 47.71 26.68 47.71Z'
export const MARK_C =
  'M39.63 48Q34.7 48 32.41 45.03Q30.13 42.06 31.01 36.37L32.54 26.71Q33.42 21.21 36.08 18.6Q38.74 16 43.55 16Q46.86 16 48.99 17.41Q51.13 18.81 51.92 21.36Q52.71 23.9 51.91 27.39Q51.78 28.05 51.24 28.05H45.57Q44.87 28.05 45 27.39Q45.5 25.02 45.03 23.69Q44.57 22.35 42.87 22.35Q41.31 22.35 40.55 23.41Q39.79 24.47 39.38 26.99L37.85 36.55Q37.44 39.2 38.01 40.42Q38.58 41.65 40.25 41.65Q41.96 41.65 42.66 40.24Q43.37 38.84 43.56 36.58Q43.64 35.91 44.23 35.91H49.89Q50.2 35.91 50.38 36.08Q50.55 36.25 50.51 36.58Q50.19 41.8 47.55 44.9Q44.91 48 39.63 48Z'

const VOLT = '#D4FF3F'
const WHITE = '#F3F6FB'

const defs = `<defs>
  <linearGradient id="ect-bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#18202F"/><stop offset=".55" stop-color="#0C1019"/><stop offset="1" stop-color="#07090F"/>
  </linearGradient>
  <radialGradient id="ect-glow-b" cx="1" cy="0" r=".75">
    <stop offset="0" stop-color="#3987E5" stop-opacity=".28"/><stop offset="1" stop-color="#3987E5" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="ect-glow-v" cx="0" cy="1" r=".7">
    <stop offset="0" stop-color="#D4FF3F" stop-opacity=".14"/><stop offset="1" stop-color="#D4FF3F" stop-opacity="0"/>
  </radialGradient>
</defs>`

/** @param {{ rx?: number, scale?: number, edge?: boolean }} o */
function svg({ rx = 15, scale = 1, edge = true } = {}) {
  const shape = (fill) => `<rect width="64" height="64" rx="${rx}" fill="${fill}"/>`
  const t = scale === 1 ? '' : ` transform="translate(32 32) scale(${scale}) translate(-32 -32)"`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
${defs}
${shape('url(#ect-bg)')}${shape('url(#ect-glow-b)')}${shape('url(#ect-glow-v)')}
${edge && rx ? `<rect x=".5" y=".5" width="63" height="63" rx="${rx - 0.5}" fill="none" stroke="#FFFFFF" stroke-opacity=".08"/>` : ''}
<g${t}><path fill="${VOLT}" d="${MARK_E}"/><path fill="${WHITE}" d="${MARK_C}"/></g>
</svg>
`
}

function loadPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim()
    return createRequire(join(globalRoot, 'noop.js'))('playwright')
  }
}

const targets = [
  // name, size, svg options
  ['icon-192.png', 192, { rx: 15 }],
  ['icon-512.png', 512, { rx: 15 }],
  // Maskable: full bleed; the monogram (≈41 units wide) scaled to ≈ 51% of the width stays inside the 80% circle.
  ['icon-maskable-512.png', 512, { rx: 0, scale: 0.8, edge: false }],
  // iOS masks the icon itself; it must be opaque and full bleed.
  ['apple-touch-icon.png', 180, { rx: 0, scale: 0.92, edge: false }],
]

async function main() {
  mkdirSync(OUT, { recursive: true })
  // Favicon: slightly larger letters so the monogram survives at 16px.
  writeFileSync(join(OUT, 'icon.svg'), svg({ rx: 14, scale: 1.1 }))
  const { chromium } = loadPlaywright()
  const browser = await chromium.launch()
  try {
    for (const [name, size, opts] of targets) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
      const markup = svg(opts).replace('<svg ', `<svg width="${size}" height="${size}" `)
      await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${markup}</body></html>`)
      await page.screenshot({ path: join(OUT, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
      await page.close()
      console.log('wrote', join('public/icons', name))
    }
  } finally {
    await browser.close()
  }
  console.log('wrote public/icons/icon.svg')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
