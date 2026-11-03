import { test, expect } from '@playwright/test'

async function start(page, config = {}, desktop = false) {
  await page.goto(desktop ? '/?desktop=1' : '/')
  await page.waitForFunction(() => window.__DSH_STARTUP_API__)
  await page.evaluate(config => {
    window.__stages = []
    window.addEventListener('dsh-startup:stage', e => window.__stages.push(e.detail.index))
    window.__DSH_STARTUP_API__.replay({
      ...window.__DSH_STARTUP_API__.config,
      speed: 3,
      voice: false,
      sound: false,
      mode: 'always',
      ...config
    })
  }, config)
}
const root = '#dsh-startup-root'
test.afterEach(async ({ request }) => {
  await request.post('/dsh-startup/config', { data: { action: 'reset' } })
})

test('ten stages and exactly two confirmations, natural finish restores host', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await start(page)
  await expect(page.locator(root)).toHaveAttribute('data-stage', '3')
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.__stages)).toEqual([0, 1, 2, 3])
  await page.getByRole('button', { name: 'GRANT ACCESS', exact: true }).click()
  await expect(page.locator(root)).toHaveAttribute('data-stage', '4')
  await expect(page.locator('.poi-dossier')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator(root)).toHaveCount(0)
  expect(await page.evaluate(() => window.__stages)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('')
  expect(await page.evaluate(() => window.__DSH_STARTUP_RUNNING__)).toBe(false)
  expect(errors).toEqual([])
})

test('skip, repeated replay and disabled skip release the correct instance', async ({ page }) => {
  await start(page)
  await expect(page.locator(root)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator(root)).toHaveCount(0)
  await page.evaluate(() => {
    const api = window.__DSH_STARTUP_API__
    for (let i = 0; i < 5; i++) api.replay({ speed: 3, voice: false })
  })
  await expect(page.locator(root)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1200)
  await expect(page.locator(root)).toHaveCount(0)
  await page.evaluate(() => {
    window.__DSH_STARTUP_API__.replay({ allowSkip: false })
  })
  await page.keyboard.press('Escape')
  await expect(page.locator(root)).toHaveCount(1)
  await expect(page.locator('.poi-skip')).toBeHidden()
  await page.evaluate(() => window.__DSH_STARTUP_API__.dispose())
  await expect(page.locator(root)).toHaveCount(0)
})

test('save identity then preview uses new saved config and safe text', async ({ page }) => {
  await start(page)
  await page.keyboard.press('Escape')
  await page.getByLabel('名称', { exact: true }).fill('人豪 <ADMIN>')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('已保存，可立即预览。')
  await page.getByRole('button', { name: '预览已保存配置' }).click()
  await expect(page.locator(root)).toBeVisible()
  expect(await page.evaluate(() => window.__DSH_STARTUP_API__.config.identity)).toBe('人豪 <ADMIN>')
  await page.evaluate(() => {
    window.__DSH_STARTUP_API__.replay({ speed: 3, voice: false })
  })
  await expect(page.locator(root)).toHaveAttribute('data-stage', '3')
  await page.keyboard.press('Enter')
  await expect(page.locator('.poi-dossier')).toContainText('人豪 <ADMIN>')
  expect(await page.locator('.poi-dossier admin').count()).toBe(0)
})

test('desktop selfBoot loads resources and does not mark shown before finish', async ({ page }) => {
  await page.goto('/?desktop=1')
  await page.waitForFunction(() => window.__DSH_STARTUP_API__)
  expect(await page.evaluate(() => window.__DSH_STARTUP_BOOT__)).toBe('client')
  expect(await page.evaluate(() => sessionStorage.getItem('dsh-startup-screen:shown'))).toBe(null)
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => sessionStorage.getItem('dsh-startup-screen:shown'))).toBe('1')
  await page.reload()
  await page.waitForFunction(() => window.__DSH_STARTUP_API__)
  await expect(page.locator(root)).toHaveCount(0)
  await page.getByRole('button', { name: '预览已保存配置' }).click()
  await expect(page.locator(root)).toBeVisible()
})

test('automatic mode and reduced motion finish without interaction or audio', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page, { requireInteraction: false, voice: true })
  await expect(page.locator(root)).toHaveCount(0, { timeout: 15000 })
  expect(await page.evaluate(() => window.__stages)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
})

test('2K and Retina layouts keep HUD in view and scene targets square', async ({
  page
}, testInfo) => {
  await start(page)
  await expect(page.locator(root)).toHaveAttribute('data-stage', '3')
  for (const size of [
    { width: 2560, height: 1440 },
    { width: 1280, height: 820 },
    { width: 1470, height: 956 },
    { width: 800, height: 650 }
  ]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(100)
    for (const selector of ['.poi-header', '.poi-status', '.poi-confirm', '.poi-skip']) {
      const box = await page.locator(selector).boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1)
      expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1)
    }
    const actions = await page.locator('.poi-actions').boundingBox()
    const feed = await page.locator('.poi-feed').boundingBox()
    expect(actions.y + actions.height).toBeLessThan(feed.y)
    const target = await page.locator('.poi-target').boundingBox()
    expect(Math.abs(target.width - target.height)).toBeLessThan(1)
    await page.screenshot({ path: testInfo.outputPath(`consent-${size.width}.png`), scale: 'css' })
  }
  expect(await page.evaluate(() => devicePixelRatio)).toBe(2)
  await page.setViewportSize({ width: 1280, height: 820 })
  await page.keyboard.press('Enter')
  await expect(page.locator(root)).toHaveAttribute('data-stage', '4')
  await page.screenshot({ path: testInfo.outputPath('identity-retina.png'), scale: 'css' })
})

test('human voice survives fast confirmation and stops on skip/replay', async ({ page }) => {
  await page.addInitScript(() => {
    window.__sources = { started: 0, ended: 0, stopped: 0, active: 0 }
    const original = AudioContext.prototype.createBufferSource
    AudioContext.prototype.createBufferSource = function (...args) {
      const source = original.apply(this, args)
      const start = source.start.bind(source),
        stop = source.stop.bind(source)
      let active = false
      const release = () => {
        if (active) {
          active = false
          window.__sources.active--
        }
      }
      source.start = (...args) => {
        active = true
        window.__sources.active++
        window.__sources.started++
        return start(...args)
      }
      source.stop = (...args) => {
        window.__sources.stopped++
        release()
        return stop(...args)
      }
      source.addEventListener('ended', () => {
        window.__sources.ended++
        release()
      })
      return source
    }
  })
  await start(page, { voice: true, sound: false })
  await expect(page.locator(root)).toHaveAttribute('data-stage', '3')
  await page.getByRole('button', { name: 'GRANT ACCESS', exact: true }).click()
  await page.waitForFunction(() => window.__sources.started > 0)
  await page.waitForTimeout(150)
  await expect(page.locator(root)).toHaveAttribute('data-stage', '3')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__sources.active === 0)
  expect(await page.evaluate(() => window.__sources.stopped)).toBeGreaterThan(0)
  await page.evaluate(() => {
    window.__DSH_STARTUP_API__.replay({ voice: true, speed: 3 })
  })
  await expect(page.locator(root)).toHaveAttribute('data-stage', '3')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__sources.started > 1)
  await page.evaluate(() => {
    window.__DSH_STARTUP_API__.replay({ voice: false })
  })
  await page.waitForFunction(() => window.__sources.active === 0)
})

test('missing image and voice resources keep confirmation and finish usable', async ({ page }) => {
  await page.route('**/dsh-startup/asset/camera-*.png', route => route.fulfill({ status: 404 }))
  await page.route('**/dsh-startup/asset/line-*.mp3', route => route.fulfill({ status: 404 }))
  await start(page, { voice: true })
  await expect(page.locator(root)).toHaveAttribute('data-stage', '3')
  await page.keyboard.press('Enter')
  await expect(page.locator(root)).toHaveAttribute('data-stage', '4')
  await page.keyboard.press('Enter')
  await expect(page.locator(root)).toHaveCount(0)
})

test('complete sequence waits for all six recordings including welcome', async ({ page }) => {
  await page.addInitScript(() => {
    window.__voice = { started: 0, ended: 0 }
    const create = AudioContext.prototype.createBufferSource
    AudioContext.prototype.createBufferSource = function (...args) {
      const source = create.apply(this, args),
        start = source.start.bind(source)
      source.start = (...args) => {
        window.__voice.started++
        return start(...args)
      }
      source.addEventListener('ended', () => window.__voice.ended++)
      return source
    }
  })
  await start(page, { voice: true })
  await expect(page.locator(root)).toHaveAttribute('data-stage', '3')
  await page.keyboard.press('Enter')
  await expect(page.locator(root)).toHaveAttribute('data-stage', '4', { timeout: 6000 })
  expect(await page.evaluate(() => window.__voice.ended)).toBe(1)
  await page.keyboard.press('Enter')
  await expect(page.locator(root)).toHaveCount(0, { timeout: 18000 })
  expect(await page.evaluate(() => window.__voice)).toEqual({ started: 6, ended: 6 })
})

test('1x desktop-scale layout matches the same scene geometry', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 1
  })
  const page = await context.newPage()
  try {
    await start(page)
    await expect(page.locator(root)).toHaveAttribute('data-stage', '3')
    expect(await page.evaluate(() => devicePixelRatio)).toBe(1)
    const box = await page.locator('.poi-target').boundingBox()
    expect(Math.abs(box.width - box.height)).toBeLessThan(1)
    await page.keyboard.press('Enter')
    await expect(page.locator('.poi-dossier')).toBeVisible()
  } finally {
    await context.close()
  }
})
