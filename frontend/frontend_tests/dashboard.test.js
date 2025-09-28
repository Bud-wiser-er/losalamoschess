// frontend_tests/dashboard.test.js
const { test, expect } = require('@playwright/test');

test.describe('Dashboard Page Tests', () => {
  test('should load dashboard page', async ({ page }) => {
    await page.goto('file://' + __dirname + '/../dashboard_page.html');
    await page.waitForLoadState('networkidle');
    
    // Check page title
    await expect(page).toHaveTitle(/Los Alamos Chess/);
    
    // Check main elements are present
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.logo-text')).toHaveText('Los Alamos Chess');
  });

  test('should display quick play options', async ({ page }) => {
    await page.goto('file://' + __dirname + '/../dashboard_page.html');
    await page.waitForLoadState('networkidle');
    
    // Check quick play cards
    await expect(page.locator('.quick-play')).toBeVisible();
    
    // Check specific play options
    const playVsComputer = page.locator('#playVsComputerBtn');
    await expect(playVsComputer).toBeVisible();
    await expect(playVsComputer).toHaveText('Play Now');
  });

  test('should display user stats', async ({ page }) => {
    await page.goto('file://' + __dirname + '/../dashboard_page.html');
    await page.waitForLoadState('networkidle');
    
    // Check stats section
    await expect(page.locator('.stats')).toBeVisible();
    
    // Check that stat cards are present
    const statCards = page.locator('.stat-card');
    const count = await statCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display recent games', async ({ page }) => {
    await page.goto('file://' + __dirname + '/../dashboard_page.html');
    await page.waitForLoadState('networkidle');
    
    // Check recent games section
    await expect(page.locator('.recent')).toBeVisible();
    
    const recentTitle = page.locator('.recent h2');
    await expect(recentTitle).toHaveText('Recent Games');
  });

  test('should open bot selection modal', async ({ page }) => {
    await page.goto('file://' + __dirname + '/../dashboard_page.html');
    await page.waitForLoadState('networkidle');
    
    // Click play vs computer button
    await page.click('#playVsComputerBtn');
    
    // Check modal opens
    const modal = page.locator('#difficultyModal');
    await expect(modal).toBeVisible();
    
    // Check bot levels are present
    const botOptions = page.locator('.bot-level-option');
    const optionCount = await botOptions.count();
    expect(optionCount).toBe(5); // L0-L4
  });

  test('should select bot level', async ({ page }) => {
    await page.goto('file://' + __dirname + '/../dashboard_page.html');
    await page.waitForLoadState('networkidle');
    
    // Open bot selection modal
    await page.click('#playVsComputerBtn');
    
    // Select L1 bot
    await page.click('[data-level="L1"]');
    
    // Check selection is highlighted
    const selectedBot = page.locator('[data-level="L1"].selected');
    await expect(selectedBot).toBeVisible();
    
    // Check confirm button is enabled
    const confirmBtn = page.locator('#confirmBotSelection');
    await expect(confirmBtn).toBeEnabled();
  });

  test('should close modal on cancel', async ({ page }) => {
    await page.goto('file://' + __dirname + '/../dashboard_page.html');
    await page.waitForLoadState('networkidle');
    
    // Open and close modal
    await page.click('#playVsComputerBtn');
    await page.click('#cancelBotSelection');
    
    // Modal should be hidden
    const modal = page.locator('#difficultyModal');
    await expect(modal).toBeHidden();
  });
});