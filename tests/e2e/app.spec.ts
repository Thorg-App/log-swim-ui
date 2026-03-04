import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import {
  launchApp,
  injectLogLines,
  sendStreamEnd,
  waitForFlush,
  createIpcLogLine
} from './helpers/electron-app'

// --- Shared Test Data ---

const DEFAULT_CLI_ARGS = [
  '--key-level', 'level',
  '--key-timestamp', 'timestamp',
  '--lanes', 'error', 'auth'
]

const SAMPLE_LOG_LINES = [
  createIpcLogLine('error', 'Connection failed to database', '2024-01-15T10:00:01.000Z', { service: 'db' }),
  createIpcLogLine('info', 'User login successful', '2024-01-15T10:00:02.000Z', { service: 'auth' }),
  createIpcLogLine('error', 'Auth token expired', '2024-01-15T10:00:03.000Z', { service: 'auth' }),
  createIpcLogLine('warn', 'High memory usage', '2024-01-15T10:00:04.000Z', { service: 'monitor' }),
  createIpcLogLine('info', 'Health check passed', '2024-01-15T10:00:05.000Z', { service: 'monitor' })
]

// --- Tests ---

test.describe('GIVEN the Electron app launched with --lanes "error" "auth"', () => {
  let electronApp: ElectronApplication
  let page: Page

  test.beforeEach(async () => {
    const app = await launchApp(DEFAULT_CLI_ARGS)
    electronApp = app.electronApp
    page = app.page
  })

  test.afterEach(async () => {
    await electronApp.close()
  })

  test('THEN it renders 3 lane headers (error, auth, unmatched)', async () => {
    const headers = page.locator('.lane-header')
    await expect(headers).toHaveCount(3)

    // Verify lane header pattern text
    const patterns = page.locator('.lane-header__pattern')
    await expect(patterns.nth(0)).toHaveText('error')
    await expect(patterns.nth(1)).toHaveText('auth')
    await expect(patterns.nth(2)).toHaveText('unmatched')
  })

  test('THEN the unmatched lane header has the unmatched CSS class', async () => {
    const unmatchedHeader = page.locator('.lane-header--unmatched')
    await expect(unmatchedHeader).toHaveCount(1)
  })

  test.describe('WHEN test log lines are injected', () => {
    test.beforeEach(async () => {
      await injectLogLines(electronApp, SAMPLE_LOG_LINES)
      await waitForFlush(page)
    })

    test('THEN log rows appear in the grid', async () => {
      const rows = page.locator('.log-row')
      // WHY: expect.toBeGreaterThan because virtualization may render a subset.
      // With 5 entries and typical window size, all should be visible.
      const count = await rows.count()
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThanOrEqual(SAMPLE_LOG_LINES.length)
    })

    test('THEN log rows display message previews', async () => {
      const messages = page.locator('.log-row__message')
      const count = await messages.count()
      expect(count).toBeGreaterThan(0)

      // Verify at least one message is from our test data
      const allText = await messages.allTextContents()
      const hasExpectedMessage = allText.some((text) => text.includes('Connection failed'))
      expect(hasExpectedMessage).toBe(true)
    })

    test('THEN clicking a log row expands it to show full JSON', async () => {
      const firstRow = page.locator('.log-row').first()
      await firstRow.click()

      // After click, expanded content should be visible
      const expandedContent = page.locator('.log-row__expanded-content')
      await expect(expandedContent).toHaveCount(1)

      // Expanded content should contain JSON fields
      const text = await expandedContent.textContent()
      expect(text).not.toBeNull()
      expect(text!).toContain('"level"')
    })

    test('THEN clicking an expanded row collapses it', async () => {
      const firstRow = page.locator('.log-row').first()

      // Expand
      await firstRow.click()
      await expect(page.locator('.log-row__expanded-content')).toHaveCount(1)

      // Collapse by clicking the expanded row directly
      await page.locator('.log-row--expanded').click()

      await expect(page.locator('.log-row__expanded-content')).toHaveCount(0)
    })

    test('THEN expanding a row pushes subsequent rows down without overlaying them', async () => {
      // GIVEN collapsed first row
      const firstRow = page.locator('.log-row').first()
      const collapsedBox = await firstRow.boundingBox()
      expect(collapsedBox).not.toBeNull()

      // WHEN expanding
      await firstRow.click()
      await expect(page.locator('.log-row__expanded-content')).toBeVisible()

      // THEN expanded row is taller
      const expandedBox = await page.locator('.log-row--expanded').boundingBox()
      expect(expandedBox).not.toBeNull()
      expect(expandedBox!.height).toBeGreaterThan(collapsedBox!.height)

      // THEN subsequent row is below (not overlaid).
      // WHY expect.poll: the virtualizer recalculates translateY for subsequent rows
      // asynchronously via ResizeObserver after the expanded height is measured.
      // We poll until the second row has settled at its new position.
      // WHY Math.floor: bounding boxes include sub-pixel values (e.g. 311.25) but the
      // browser rounds translateY to whole pixels, so we compare at integer granularity.
      const expandedBottom = Math.floor(expandedBox!.y + expandedBox!.height)
      await expect.poll(async () => {
        const box = await page.locator('.log-row').nth(1).boundingBox()
        return box !== null ? Math.floor(box.y) : 0
      }).toBeGreaterThanOrEqual(expandedBottom)
    })
  })

  test.describe('WHEN a raw filter is applied', () => {
    test.beforeEach(async () => {
      await injectLogLines(electronApp, SAMPLE_LOG_LINES)
      await waitForFlush(page)
    })

    test('THEN only matching rows remain visible', async () => {
      // Get initial row count
      const initialCount = await page.locator('.log-row').count()
      expect(initialCount).toBeGreaterThan(0)

      // Click "+ Filter" button to open filter form
      await page.locator('.filter-bar .filter-add-btn', { hasText: '+ Filter' }).click()

      // Type pattern into the regex input (raw mode is default)
      const patternInput = page.locator('.filter-bar__input[placeholder="regex pattern"]')
      await patternInput.fill('Connection failed')

      // Click Add button
      await page.locator('.filter-bar__form .filter-add-btn', { hasText: 'Add' }).click()

      // Wait for filter to take effect (re-render)
      await page.waitForTimeout(200)

      // After filtering, fewer rows should be visible
      const filteredCount = await page.locator('.log-row').count()
      expect(filteredCount).toBeLessThan(initialCount)
      expect(filteredCount).toBeGreaterThan(0)

      // The visible row should contain "Connection failed"
      const messages = await page.locator('.log-row__message').allTextContents()
      expect(messages.every((m) => m.includes('Connection failed'))).toBe(true)
    })
  })

  test.describe('WHEN a new lane is added via LaneAddInput', () => {
    test('THEN a new lane header appears before "unmatched"', async () => {
      // Initially 3 lanes: error, auth, unmatched
      await expect(page.locator('.lane-header')).toHaveCount(3)

      // Type a regex pattern in the lane-add input
      const laneInput = page.locator('.lane-add-input__field')
      await laneInput.fill('monitor')
      await laneInput.press('Enter')

      // Now there should be 4 lane headers
      await expect(page.locator('.lane-header')).toHaveCount(4)

      // Verify order: error, auth, monitor, unmatched
      const patterns = page.locator('.lane-header__pattern')
      await expect(patterns.nth(0)).toHaveText('error')
      await expect(patterns.nth(1)).toHaveText('auth')
      await expect(patterns.nth(2)).toHaveText('monitor')
      await expect(patterns.nth(3)).toHaveText('unmatched')
    })
  })

  test.describe('WHEN the mode toggle is used', () => {
    test('THEN default mode is Live', async () => {
      const activeOption = page.locator('.mode-toggle__option--active')
      await expect(activeOption).toHaveText('Live')
    })

    test('THEN clicking Scroll switches to Scroll mode', async () => {
      const scrollButton = page.locator('.mode-toggle__option', { hasText: 'Scroll' })
      await scrollButton.click()

      const activeOption = page.locator('.mode-toggle__option--active')
      await expect(activeOption).toHaveText('Scroll')
    })
  })

  test.describe('WHEN stream-end is signaled', () => {
    test('THEN stream-ended indicator appears', async () => {
      // Initially no stream-ended indicator
      await expect(page.locator('.stream-ended')).toHaveCount(0)

      // Send stream end signal
      await sendStreamEnd(electronApp)

      // Wait for the indicator to appear
      await expect(page.locator('.stream-ended')).toHaveCount(1)
      await expect(page.locator('.stream-ended')).toContainText('Stream ended')
    })

    test('THEN mode switches to Scroll', async () => {
      // Verify default mode is Live before stream end
      const activeOption = page.locator('.mode-toggle__option--active')
      await expect(activeOption).toHaveText('Live')

      // Send stream end signal
      await sendStreamEnd(electronApp)

      // Mode should auto-switch to Scroll
      await expect(activeOption).toHaveText('Scroll')
    })
  })

  test.describe('WHEN a lane header pattern is clicked to edit', () => {
    test('THEN an edit input appears with the current pattern', async () => {
      // Click the first lane header pattern text
      const firstPattern = page.locator('[data-testid="lane-header-pattern"]').first()
      await firstPattern.click()

      // Edit input should appear
      const editInput = page.locator('[data-testid="lane-header-edit-input"]')
      await expect(editInput).toHaveCount(1)
      await expect(editInput).toHaveValue('error')
    })

    test('THEN pressing Enter with a new pattern updates the lane header', async () => {
      // Click the first lane header pattern text to enter edit mode
      const firstPattern = page.locator('[data-testid="lane-header-pattern"]').first()
      await firstPattern.click()

      // Clear and type new pattern
      const editInput = page.locator('[data-testid="lane-header-edit-input"]')
      await editInput.fill('warn|error')
      await editInput.press('Enter')

      // Verify the lane header now shows the new pattern
      const updatedPattern = page.locator('[data-testid="lane-header-pattern"]').first()
      await expect(updatedPattern).toHaveText('warn|error')
    })

    test('THEN pressing Escape cancels the edit', async () => {
      // Click the first lane header pattern text to enter edit mode
      const firstPattern = page.locator('[data-testid="lane-header-pattern"]').first()
      await firstPattern.click()

      // Type a new value then cancel
      const editInput = page.locator('[data-testid="lane-header-edit-input"]')
      await editInput.fill('something-else')
      await editInput.press('Escape')

      // Verify the original pattern is restored
      const restoredPattern = page.locator('[data-testid="lane-header-pattern"]').first()
      await expect(restoredPattern).toHaveText('error')
    })
  })

  test.describe('WHEN a lane remove button is clicked', () => {
    test('THEN the lane is removed and lane count decreases', async () => {
      // Initially 3 lanes: error, auth, unmatched
      await expect(page.locator('.lane-header')).toHaveCount(3)

      // Click the remove button on the first lane (error)
      const removeBtn = page.locator('[data-testid="lane-header-remove"]').first()
      await removeBtn.click()

      // Now there should be 2 lane headers: auth, unmatched
      await expect(page.locator('.lane-header')).toHaveCount(2)

      // Verify the remaining lanes
      const patterns = page.locator('[data-testid="lane-header-pattern"]')
      await expect(patterns.nth(0)).toHaveText('auth')
      // Unmatched lane does not have data-testid="lane-header-pattern" (it still has .lane-header__pattern)
      const unmatchedPattern = page.locator('.lane-header--unmatched .lane-header__pattern')
      await expect(unmatchedPattern).toHaveText('unmatched')
    })
  })

  test.describe('WHEN the case sensitivity toggle is clicked on a lane header', () => {
    test('THEN the toggle text changes from aa to Aa', async () => {
      // Initially case insensitive (aa) - the new default
      const caseToggle = page.locator('[data-testid="lane-header-case-toggle"]').first()
      await expect(caseToggle).toHaveText('aa')

      // Click to toggle to case sensitive
      await caseToggle.click()

      // Should now show "Aa"
      await expect(caseToggle).toHaveText('Aa')
    })

    test('THEN clicking again reverts to case insensitive (aa)', async () => {
      const caseToggle = page.locator('[data-testid="lane-header-case-toggle"]').first()

      // Toggle to case sensitive
      await caseToggle.click()
      await expect(caseToggle).toHaveText('Aa')

      // Toggle back to case insensitive
      await caseToggle.click()
      await expect(caseToggle).toHaveText('aa')
    })
  })

  test.describe('WHEN the settings gear icon is clicked', () => {
    test('THEN the settings panel and backdrop appear', async () => {
      // Initially no settings panel or backdrop visible
      await expect(page.locator('[data-testid="settings-panel"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="settings-backdrop"]')).toHaveCount(0)

      // Click the gear icon
      await page.locator('.settings-trigger').click()

      // Settings panel and backdrop should be visible
      await expect(page.locator('[data-testid="settings-panel"]')).toHaveCount(1)
      await expect(page.locator('[data-testid="settings-backdrop"]')).toHaveCount(1)
    })

    test('THEN changing a color value updates the CSS variable (live preview)', async () => {
      // Open settings
      await page.locator('.settings-trigger').click()
      await expect(page.locator('[data-testid="settings-panel"]')).toHaveCount(1)

      // Find the background color input and change its value
      const bgInput = page.locator('input[data-field="colors.background"]')
      await bgInput.fill('#FF0000')

      // Wait for debounced CSS update (150ms debounce + margin)
      await page.waitForTimeout(300)

      // Verify the CSS variable was updated on :root
      const bgColor = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--color-bg')
      )
      expect(bgColor).toBe('#FF0000')
    })

    test('THEN clicking the backdrop closes the settings panel', async () => {
      // Open settings
      await page.locator('.settings-trigger').click()
      await expect(page.locator('[data-testid="settings-panel"]')).toHaveCount(1)

      // Click the backdrop
      await page.locator('[data-testid="settings-backdrop"]').click()

      // Settings panel and backdrop should be hidden
      await expect(page.locator('[data-testid="settings-panel"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="settings-backdrop"]')).toHaveCount(0)
    })
  })
})
