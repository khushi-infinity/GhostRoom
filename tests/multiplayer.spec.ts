import { test, expect } from '@playwright/test';

test.describe('GhostRoom Multiplayer Flow', () => {
  test('Two-user chat and graph generation', async ({ browser }) => {
    test.setTimeout(180000);
    
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    console.log('Testing Create Room...');
    // --- Khushi creates room ---
    await pageA.goto('http://localhost:5173/');
    await pageA.click('button:has-text("Create a Room →")');
    
    await pageA.fill('input[id="display-name"]', 'Khushi');
    await pageA.fill('input[id="room-value"]', 'Product Strategy');
    await pageA.click('button:has-text("Create Room →")');
    
    // Wait for the success screen
    await pageA.waitForSelector('text=Room created');
    
    // Extract code
    const codeElement = await pageA.waitForSelector('.invite-code');
    const roomCode = (await codeElement.innerText()).trim();
    expect(roomCode).toMatch(/^GR-[A-Z0-9]+$/);
    console.log('Room Code created:', roomCode);

    // Enter room
    await pageA.click('button:has-text("Enter Room →")');
    
    // Wait for chat to be ready
    await pageA.waitForSelector('.chat-panel', { state: 'visible', timeout: 20000 });
    console.log('Khushi entered room.');

    console.log('Testing Join Room...');
    // --- Alex joins room ---
    await pageB.goto('http://localhost:5173/');
    await pageB.click('button:has-text("Join a Room")');
    
    await pageB.fill('input[id="display-name"]', 'Alex');
    await pageB.fill('input[id="room-value"]', roomCode);
    await pageB.click('button:has-text("Join Room →")');
    
    // Wait for chat
    await pageB.waitForSelector('.chat-panel', { state: 'visible', timeout: 20000 });
    console.log('Alex joined room.');

    // Helper to send a message
    async function sendMessage(page: any, text: string) {
      const textbox = page.getByRole('textbox', { name: 'Type a message' });
      await textbox.click();
      await textbox.fill(text);
      // Wait for send button to be enabled or press Enter
      const sendButton = page.locator('button:has-text("SEND"), button[title="SEND"], button[aria-label="SEND"]').first();
      if (await sendButton.isVisible()) {
        await sendButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
    }

    console.log('Testing messaging...');
    // Khushi sends "Hey Alex"
    await sendMessage(pageA, 'Hey Alex');
    console.log('Khushi sent: Hey Alex');

    // Alex receives message
    await pageB.waitForSelector('text=Hey Alex', { timeout: 15000 });
    console.log('Alex received: Hey Alex');

    // Alex sends reply "Hey Khushi"
    await sendMessage(pageB, 'Hey Khushi');
    console.log('Alex sent: Hey Khushi');

    // Khushi receives reply
    await pageA.waitForSelector('text=Hey Khushi', { timeout: 15000 });
    console.log('Khushi received: Hey Khushi');

    // --- Verify Participants ---
    console.log('Verifying participant roster...');
    await pageA.waitForSelector('.participant-roster >> text=Alex', { timeout: 10000 });
    await pageA.waitForSelector('.participant-roster >> text=Khushi', { timeout: 10000 });
    await pageB.waitForSelector('.participant-roster >> text=Alex', { timeout: 10000 });
    await pageB.waitForSelector('.participant-roster >> text=Khushi', { timeout: 10000 });
    console.log('Participant roster verified on both sides.');

    // --- Knowledge Graph Discussion ---
    console.log('Sending discussion for knowledge graph...');
    await sendMessage(pageA, 'We should launch GhostRoom for startup teams.');
    await pageB.waitForSelector('text=We should launch GhostRoom for startup teams.', { timeout: 15000 });

    await sendMessage(pageB, 'I disagree. Research teams have more complex discussions.');
    await pageA.waitForSelector('text=I disagree. Research teams have more complex discussions.', { timeout: 15000 });

    await sendMessage(pageA, "Good point. Let's target research teams first.");
    await pageB.waitForSelector("text=Good point. Let's target research teams first.", { timeout: 15000 });

    console.log('Waiting for graph extraction to process...');
    // Wait for nodes to appear in React Flow
    await pageA.waitForSelector('.react-flow__node', { timeout: 60000 });
    const nodesA = await pageA.locator('.react-flow__node').count();
    expect(nodesA).toBeGreaterThan(0);
    console.log(`Graph generated on Khushi's side with ${nodesA} nodes.`);

    await pageB.waitForSelector('.react-flow__node', { timeout: 60000 });
    const nodesB = await pageB.locator('.react-flow__node').count();
    expect(nodesB).toBeGreaterThan(0);
    console.log(`Graph generated on Alex's side with ${nodesB} nodes.`);

    // Click on a node in Khushi's view to verify detail panel and provenance
    console.log('Verifying graph node source message provenance...');
    await pageA.locator('.react-flow__node').first().click();
    await pageA.waitForSelector('.node-details', { timeout: 10000 });
    const sourceMessages = await pageA.locator('.source-message').count();
    console.log(`Node details opened with ${sourceMessages} source messages.`);
    expect(sourceMessages).toBeGreaterThan(0);

    // --- Refresh Test ---
    console.log('Testing refresh...');
    await pageA.reload();
    await pageA.waitForSelector('.chat-panel', { state: 'visible', timeout: 30000 });
    await pageA.waitForSelector('.react-flow__node', { timeout: 30000 });
    const nodesARefreshed = await pageA.locator('.react-flow__node').count();
    expect(nodesARefreshed).toBeGreaterThan(0);
    await pageA.waitForSelector("text=Good point. Let's target research teams first.", { timeout: 30000 });
    console.log(`Khushi refreshed successfully, graph retained with ${nodesARefreshed} nodes.`);

    await pageB.reload();
    await pageB.waitForSelector('.chat-panel', { state: 'visible', timeout: 30000 });
    await pageB.waitForSelector('.react-flow__node', { timeout: 30000 });
    const nodesBRefreshed = await pageB.locator('.react-flow__node').count();
    expect(nodesBRefreshed).toBeGreaterThan(0);
    await pageB.waitForSelector("text=Good point. Let's target research teams first.", { timeout: 30000 });
    console.log(`Alex refreshed successfully, graph retained with ${nodesBRefreshed} nodes.`);

    await contextA.close();
    await contextB.close();
    console.log('ALL MULTIPLAYER TESTS PASSED SUCCESSFULLY!');
  });
});
