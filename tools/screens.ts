// Screenshot tool: takes pictures of the game's screens at phone sizes, so you can
// check how they look without a phone.
//
// How to use it:
//   1. Start the game:    npx vite --host 127.0.0.1 --port 5199 --strictPort
//   2. In another window: npm run screens                  (every scenario)
//                         npm run screens -- home fight    (only the scenarios named)
//   3. Look at the PNGs in the `screens/` folder: screens/<shot>-<width>x<height>.png
//
// The scenarios live in tools/screens.json. Each one is a name and a list of steps:
//   { "save": {...} }            empty the game's storage, write this save and reload (null = no save)
//   { "eval": "js code" }        run JavaScript in the page
//   { "click": "css selector" }  click an element; "text=Fight" clicks a button containing "Fight"
//   { "wait": 1000 }             wait this many milliseconds
//   { "shot": "home" }           take a picture of what is on screen ("full": true = the whole page)
//   { "include": "setup" }       run the steps of another scenario here (shared steps live once)
// A scenario with "helper": true only holds shared steps: it is never run on its own.
// Every scenario starts on a fresh load of the game and runs once per phone size.
// Errors from the page (console errors, crashes, files that failed to load) are printed
// next to each picture.
//
// Settings (environment variables):
//   BASE    where the game runs (default http://127.0.0.1:5199/brute/)
//   CHROME  the Chrome program (default C:/Program Files/Google/Chrome/Application/chrome.exe)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5199/brute/';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SAVE_KEY = 'brute.save';
/** The tool's own folder and the project folder, so it works from any working directory. */
const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(TOOLS_DIR, '..', 'screens');
/** Phone sizes to test, in CSS pixels: a small Android phone and a recent iPhone. */
const SIZES: [number, number][] = [
  [360, 640],
  [390, 844],
];
/** How long to let the screen settle (entrance animations) after a load or a click. */
const SETTLE_AFTER_LOAD = 1200;
const SETTLE_AFTER_CLICK = 800;
const SETTLE_AFTER_EVAL = 300;

interface Step {
  save?: object | null;
  eval?: string;
  click?: string;
  wait?: number;
  shot?: string;
  full?: boolean;
  include?: string;
}

interface Scenario {
  name: string;
  helper?: boolean;
  steps: Step[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Pick the scenarios to run ----

const allScenarios: Scenario[] = JSON.parse(readFileSync(join(TOOLS_DIR, 'screens.json'), 'utf8'));
const runnable = allScenarios.filter((s) => !s.helper);
const wanted = process.argv.slice(2);
for (const name of wanted) {
  if (!runnable.some((s) => s.name === name)) {
    console.error(`No scenario called "${name}". Known: ${runnable.map((s) => s.name).join(', ')}`);
    process.exit(1);
  }
}
const scenarios = wanted.length ? runnable.filter((s) => wanted.includes(s.name)) : runnable;

/** A scenario's steps with every { "include": ... } replaced by the included steps. */
function expandSteps(steps: Step[], seen: string[] = []): Step[] {
  return steps.flatMap((step) => {
    if (step.include === undefined) return [step];
    const included = allScenarios.find((s) => s.name === step.include);
    if (!included) throw new Error(`"include": no scenario called "${step.include}"`);
    if (seen.includes(step.include)) throw new Error(`"include": "${step.include}" includes itself`);
    return expandSteps(included.steps, [...seen, step.include]);
  });
}
// Check every include before starting Chrome, so a typo fails straight away.
const plans = scenarios.map((s) => ({ name: s.name, steps: expandSteps(s.steps, [s.name]) }));

// ---- Check the game is running ----

try {
  await fetch(BASE);
} catch {
  console.error(`The game is not running at ${BASE}`);
  console.error('Start it first:  npx vite --host 127.0.0.1 --port 5199 --strictPort');
  process.exit(1);
}

// ---- Start Chrome without a window ----

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set the CHROME environment variable to its path.`);
  process.exit(1);
}
// A throwaway profile, so the real Chrome profile is never touched.
const profile = mkdtempSync(join(tmpdir(), 'brute-screens-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  // Port 0 lets Chrome pick a free port; it writes the port into DevToolsActivePort.
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--hide-scrollbars',
  'about:blank',
]);

/** Waits for Chrome to start and returns the address to talk to its open tab. */
async function findPage(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
      const targets: { type: string; webSocketDebuggerUrl: string }[] = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Not ready yet: try again.
    }
  }
  throw new Error('Chrome did not start');
}

// ---- Talk to Chrome (the DevTools protocol: JSON messages over a WebSocket) ----

// Everything that talks to Chrome runs inside try/finally, so Chrome is closed and its
// throwaway profile removed even when something goes wrong.
let failures = 0;
let ws: WebSocket | undefined;
try {
  const socket = new WebSocket(await findPage());
  ws = socket;
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));

  let nextId = 0;
  /** Replies we are waiting for, by message id. */
  const replies = new Map<number, (msg: any) => void>();
  /** Errors from the page since the last picture. */
  let pageErrors: string[] = [];
  /** Called when the page finishes loading (set while we wait for a load). */
  let onLoad: (() => void) | null = null;

  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id !== undefined) {
      replies.get(msg.id)?.(msg);
      replies.delete(msg.id);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const details = msg.params.exceptionDetails;
      pageErrors.push(`crash: ${details.exception?.description ?? details.text}`);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const text = msg.params.args.map((a: any) => a.value ?? a.description).join(' ');
      pageErrors.push(`console error: ${text}`);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      // Things the browser itself reports, like a picture or file that failed to load (404).
      const entry = msg.params.entry;
      pageErrors.push(`load error: ${entry.text}${entry.url ? ` (${entry.url})` : ''}`);
    } else if (msg.method === 'Page.loadEventFired') {
      onLoad?.();
    }
  });

  /** Sends one command to Chrome and waits for its answer. */
  function send(method: string, params: object = {}): Promise<any> {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      replies.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Runs JavaScript in the page and returns its result. */
  async function run(code: string): Promise<unknown> {
    const result = await send('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  }

  /** Does something that loads the page, and waits until the page has loaded. */
  async function loadPage(action: () => Promise<unknown>): Promise<void> {
    const loaded = new Promise<void>((resolve) => (onLoad = resolve));
    await action();
    await Promise.race([loaded, sleep(10_000)]);
    onLoad = null;
    await sleep(SETTLE_AFTER_LOAD);
  }

  /** Clicks an element: a CSS selector, or "text=Some text" for a button containing that text. */
  async function click(target: string): Promise<void> {
    const find = target.startsWith('text=')
      ? `[...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(target.slice(5))}))`
      : `document.querySelector(${JSON.stringify(target)})`;
    const found = await run(`(() => { const el = ${find}; if (!el) return false; el.click(); return true; })()`);
    if (!found) throw new Error(`nothing to click for "${target}"`);
    await sleep(SETTLE_AFTER_CLICK);
  }

  /** Saves a picture of the screen (or of the whole page) to screens/<name>-<width>x<height>.png. */
  async function shot(name: string, full: boolean, width: number, height: number): Promise<void> {
    let params: object = { format: 'png' };
    if (full) {
      const pageHeight = Number(await run('document.documentElement.scrollHeight'));
      params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: pageHeight, scale: 1 } };
    }
    const result = await send('Page.captureScreenshot', params);
    const file = join(OUT_DIR, `${name}-${width}x${height}.png`);
    writeFileSync(file, Buffer.from(result.data, 'base64'));
    console.log(`  ${file}${pageErrors.length ? '' : '  (no errors)'}`);
    for (const error of pageErrors) console.log(`    ${error}`);
    pageErrors = [];
  }

  // ---- Run the scenarios ----

  mkdirSync(OUT_DIR, { recursive: true });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  for (const scenario of plans) {
    for (const [width, height] of SIZES) {
      console.log(`${scenario.name} at ${width}x${height}`);
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
      pageErrors = [];
      try {
        await loadPage(() => send('Page.navigate', { url: BASE }));
        for (const step of scenario.steps) {
          if (step.save !== undefined) {
            // Storage is emptied first (the save and the open tab), so every scenario starts the same.
            await run('localStorage.clear()');
            if (step.save !== null) await run(`localStorage.setItem('${SAVE_KEY}', ${JSON.stringify(JSON.stringify(step.save))})`);
            await loadPage(() => send('Page.reload'));
          }
          if (step.eval !== undefined) {
            // The braces keep each step's variables to itself, so two steps can both use `const s`.
            await run(`{ ${step.eval} }`);
            await sleep(SETTLE_AFTER_EVAL);
          }
          if (step.click !== undefined) await click(step.click);
          if (step.wait !== undefined) await sleep(step.wait);
          if (step.shot !== undefined) await shot(step.shot, step.full ?? false, width, height);
        }
      } catch (error) {
        failures++;
        console.log(`  FAILED: ${(error as Error).message}`);
        for (const e of pageErrors) console.log(`    ${e}`);
      }
    }
  }
} catch (error) {
  failures++;
  console.error(`Stopped: ${(error as Error).message}`);
} finally {
  // ---- Clean up ----
  ws?.close();
  chrome.kill();
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Chrome may still hold a file for a moment; the temp folder gets cleaned up eventually.
  }
}
console.log(failures ? `${failures} scenario run(s) failed.` : 'Done.');
process.exit(failures ? 1 : 0);
