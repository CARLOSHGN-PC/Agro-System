import { test, expect } from '@playwright/test';

test('login and view shapefile config', async ({ page }) => {
  await page.goto('http://localhost:5173/Agro-System/');

  // Click login button
  await page.click('button:has-text("Entrar agora")');

  // Wait for post login screen
  await page.waitForSelector('text=AgroSystem');

  // Take a screenshot of the map view (which is the default active module)
  await page.screenshot({ path: '/home/jules/verification/map_view.png' });
});
