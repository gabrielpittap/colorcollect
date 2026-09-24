import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9333;
const url = process.argv[2] || 'http://localhost:5173';
const outputFile = process.argv[3] || 'current_render.png';

const chromeProcess = spawn(chromePath, [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  '--hide-scrollbars',
  '--disable-gpu',
  '--no-sandbox',
  'about:blank'
], { stdio: 'ignore' });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        const data = await res.json();
        wsUrl = data.webSocketDebuggerUrl;
        if (wsUrl) break;
      } catch (e) {}
    }

    if (!wsUrl) {
      throw new Error('Failed to connect to Chrome debugging port');
    }

    const ws = new WebSocket(wsUrl);
    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg);
        callbacks.delete(msg.id);
      }
    };

    await new Promise(res => ws.onopen = res);

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        callbacks.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    // Set mobile viewport 430x932 (9:16)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      mobile: true
    });

    // Create a new target page
    const { targetId } = (await send('Target.createTarget', { url })).result;
    
    // Connect to this target page
    const pageTarget = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const targetObj = pageTarget.find(t => t.id === targetId);
    
    const pageWs = new WebSocket(targetObj.webSocketDebuggerUrl);
    const pageCallbacks = new Map();
    let pageId = 1;

    pageWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pageCallbacks.has(msg.id)) {
        pageCallbacks.get(msg.id)(msg);
        pageCallbacks.delete(msg.id);
      }
    };

    await new Promise(res => pageWs.onopen = res);

    function sendPage(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = pageId++;
        pageCallbacks.set(msgId, resolve);
        pageWs.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await sendPage('Page.enable');
    await sendPage('Page.navigate', { url });
    await sendPage('Emulation.setDeviceMetricsOverride', {
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      mobile: true
    });

    // Wait for canvas to load and render several frames
    await sleep(3500);

    // Click multiple supply buttons to fill docks and spawn robots of multiple colors
    await sendPage('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button[title*="Puxar caixa"]'));
        if (btns[0]) btns[0].click();
        if (btns[1]) btns[1].click();
        if (btns[2]) btns[2].click();
      `
    });
    // Wait for robots to spawn, navigate, harvest, queue, deposit, and exit
    await sleep(5200);

    const { result } = await sendPage('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(result.data, 'base64');
    fs.writeFileSync(outputFile, buffer);
    console.log(`Screenshot saved to ${outputFile}`);

    pageWs.close();
    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

run().catch(err => {
  console.error(err);
  try { chromeProcess.kill(); } catch (e) {}
  process.exit(1);
});
