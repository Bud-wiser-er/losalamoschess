// frontend_tests/game.test.js
const { test, expect } = require('@playwright/test');

test.describe('Chess Game Board Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Use file:// protocol to load HTML directly
    await page.goto('file://' + __dirname + '/../game_view.html');
    
    // Wait for board to be initialized
    await page.waitForSelector('#board .square', { timeout: 10000 });
  });

  test('should render 6x6 board with correct squares', async ({ page }) => {
    // Check that board has 36 squares (6x6)
    const squares = await page.locator('#board .square').count();
    expect(squares).toBe(36);
    
    // Check that squares have alternating colors
    const firstSquare = page.locator('#board .square').first();
    const hasLightOrDark = await firstSquare.evaluate(el => 
      el.classList.contains('light') || el.classList.contains('dark')
    );
    expect(hasLightOrDark).toBe(true);
  });

  test('should have initial piece setup', async ({ page }) => {
    // Check white pieces on bottom rows
    const whiteKing = page.locator('#d1 .piece');
    await expect(whiteKing).toHaveText('♔');
    
    const whiteQueen = page.locator('#c1 .piece');
    await expect(whiteQueen).toHaveText('♕');
    
    // Check black pieces on top rows
    const blackKing = page.locator('#d6 .piece');
    await expect(blackKing).toHaveText('♚');
  });

  test('should display player cards', async ({ page }) => {
    // Check that player cards are visible
    await expect(page.locator('#player-card')).toBeVisible();
    await expect(page.locator('#opponent-card')).toBeVisible();
  });

  test('should display game controls', async ({ page }) => {
    // Check that game control buttons exist
    await expect(page.locator('#back-btn')).toBeVisible();
    await expect(page.locator('#resign-btn')).toBeVisible();
    await expect(page.locator('#offer-draw-btn')).toBeVisible();
  });
});

test.describe('Game Controls Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('file://' + __dirname + '/../game_view.html');
    await page.waitForSelector('#board', { timeout: 10000 });
  });

  test('should show confirmation modal for resign', async ({ page }) => {
    await page.click('#resign-btn');
    
    // Check modal appears
    const modal = page.locator('#modalOverlay');
    await expect(modal).toBeVisible();
    
    const modalTitle = page.locator('#modalTitle');
    await expect(modalTitle).toHaveText('Resign?');
  });

  test('should handle modal cancellation', async ({ page }) => {
    await page.click('#resign-btn');
    await page.click('#modalCancel');
    
    // Modal should be hidden
    const modal = page.locator('#modalOverlay');
    await expect(modal).toBeHidden();
  });
});