import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://localhost:4180'
const OUT = '.refs/compare'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 1280, height: 832 })

async function appShot(name, path, dayState) {
  await page.goto(BASE + '/ops/kasir/login')
  await page.evaluate((st) => {
    sessionStorage.setItem('corney_kasir_branch', st.branchId)
    sessionStorage.setItem('corney_day', JSON.stringify(st))
  }, dayState)
  await page.goto(BASE + path)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/app-${name}.png` })
  console.log('app-' + name)
}

// Login (clear state so no redirect)
await page.goto(BASE + '/ops/kasir/login')
await page.evaluate(() => sessionStorage.clear())
await page.goto(BASE + '/ops/kasir/login')
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/app-login.png` })
console.log('app-login')

const base = {
  branchId: 'sepinggan', startedAt: 1,
  openingStock: { mozza: 18, sosis: 3, jumbo: 0, mix: 15 },
  stock: { mozza: 18, sosis: 3, jumbo: 0, mix: 15 },
  susut: {}, stockArrivalLog: {}, cash: { opening: 100000 }, sales: [],
}
await appShot('opening', '/ops/kasir/opening', { ...base, phase: 'opening', cart: [] })
await appShot('cash', '/ops/kasir/cash', { ...base, phase: 'cash', cart: [] })
await appShot('walkin', '/ops/kasir/jualan', {
  ...base, phase: 'selling',
  cart: [
    { sig: 'mozza_ori:keju', menuId: 'mozza_ori', parent: 'mozza', sauces: [{ id: 'keju', name: 'Saus Keju', price: 3000 }], qty: 2 },
    { sig: 'sweet_coklat:', menuId: 'sweet_coklat', parent: 'mozza', sauces: [], qty: 1 },
  ],
})

// Reference code.html screenshots
const refs = {
  login: 'corney_pos_login_landscape',
  opening: 'stock_confirmation_buka_toko',
  cash: 'buka_kas_buka_toko',
  walkin: 'walk_in_sale_corney_pos',
}
const cwd = process.cwd().replace(/\\/g, '/')
for (const [k, folder] of Object.entries(refs)) {
  await page.goto(`file:///${cwd}/src/refrenceUI/UIrefrence/${folder}/code.html`)
  await page.waitForTimeout(1800) // tailwind CDN + fonts + images
  await page.screenshot({ path: `${OUT}/ref-${k}.png` })
  console.log('ref-' + k)
}

await browser.close()
console.log('DONE')
