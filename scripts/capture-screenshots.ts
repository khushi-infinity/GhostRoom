import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // Retina resolution
  });
  const page = await context.newPage();

  console.log('Navigating to landing page...');
  await page.goto('http://localhost:5173/');
  await page.waitForSelector('.room-card');
  
  // 1. Capture Landing Screen
  await page.screenshot({ path: resolve('docs/screenshots/landing.png') });
  console.log('Captured landing.png');

  // Fill in create room form
  await page.click('button:has-text("Create a Room →")');
  await page.fill('input[id="display-name"]', 'Khushi');
  await page.fill('input[id="room-value"]', 'Product Strategy');
  await page.click('button:has-text("Create Room →")');
  
  await page.waitForSelector('text=Room created');
  const codeElement = await page.waitForSelector('.invite-code');
  const roomCode = (await codeElement.innerText()).trim();
  console.log('Created room:', roomCode);

  await page.click('button:has-text("Enter Room →")');
  await page.waitForSelector('.chat-panel', { state: 'visible', timeout: 25000 });
  await page.waitForTimeout(2000);

  // Send a rich multi-turn conversation that creates an insightful graph
  const textbox = page.getByRole('textbox', { name: 'Type a message' });
  const sendButton = page.locator('button:has-text("SEND"), button[title="SEND"], button[aria-label="SEND"]').first();

  async function post(text: string) {
    await textbox.fill(text);
    if (await sendButton.isVisible()) await sendButton.click();
    else await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }

  console.log('Posting discussion messages...');
  await post('We should launch GhostRoom for startup teams.');
  await post('Research teams also have complex multi-threaded discussions.');
  await post('Good point. Let\'s target research teams first as our primary pilot.');
  await post('Action item: I will prepare a user testing guide by Friday.');

  console.log('Waiting for AI Knowledge Graph generation...');
  await page.waitForSelector('.react-flow__node', { timeout: 60000 });
  // Wait a few seconds for layout stabilization
  await page.waitForTimeout(4000);

  // 2. Capture Workspace
  await page.screenshot({ path: resolve('docs/screenshots/workspace.png') });
  console.log('Captured workspace.png');

  // 3. Open a node detail panel
  const firstNode = page.locator('.react-flow__node').first();
  await firstNode.click();
  await page.waitForSelector('.node-details', { timeout: 10000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: resolve('docs/screenshots/node-details.png') });
  console.log('Captured node-details.png');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
