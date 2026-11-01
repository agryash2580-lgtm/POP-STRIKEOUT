// Real installed-extension tests with website/capture access in temporary profiles.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, cp, writeFile, mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {chromium, firefox} from '@playwright/test';

const root = process.cwd();
const temporary = await mkdtemp(path.join(os.tmpdir(), 'pop-browser-test-'));
const server = createServer(async (req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(await readFile(path.join(root, 'public', 'pop-demo.html')));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
await mkdir(path.join(root, 'output', 'pop'), {recursive: true});

// Firefox's official remote debugger can install a temporary add-on while the
// browser is controlled by Playwright. No developer profile is modified.
async function installFirefoxAddon(port, addonPath) {
  let socket;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      socket = await new Promise((resolve, reject) => {
        const client = net.connect(port, '127.0.0.1');
        client.once('connect', () => resolve(client));
        client.once('error', reject);
      });
      break;
    } catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  if (!socket) throw Error('Firefox debugger did not start.');
  let buffer = Buffer.alloc(0);
  const waiting = [];
  const packets = [];
  socket.on('data', data => {
    buffer = Buffer.concat([buffer, data]);
    while (true) {
      const colon = buffer.indexOf(':');
      if (colon < 0) return;
      const length = Number(buffer.subarray(0, colon).toString());
      if (buffer.length < colon + 1 + length) return;
      const packet = JSON.parse(buffer.subarray(colon + 1, colon + 1 + length));
      buffer = buffer.subarray(colon + 1 + length);
      if (packet.applicationType) continue; // Initial greeting is not a request reply.
      const index = waiting.findIndex(item => item.actor === packet.from && !packet.type);
      if (index >= 0) { waiting.splice(index, 1)[0].resolve(packet); } else packets.push(packet);
    }
  });
  function request(actor, type, extra = {}) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Firefox debugger timeout: ' + type)), 15000);
      waiting.push({actor, resolve: packet => { clearTimeout(timer); resolve(packet); }});
      const text = JSON.stringify({to: actor, type, ...extra});
      socket.write(Buffer.byteLength(text) + ':' + text);
    });
  }
  const info = await request('root', 'getRoot');
  if (!info.addonsActor) throw Error('Firefox did not expose its add-on actor: ' + JSON.stringify(info));
  const installed = await request(info.addonsActor, 'installTemporaryAddon', {addonPath});
  const addons = await request('root', 'listAddons');
  if (installed.error) throw Error('Firefox refused extension: ' + JSON.stringify(installed));
  const addon = addons.addons.find(item => item.id === 'pop@strikeout.app');
  const watcher = await request(addon.actor, 'getWatcher', {isServerTargetSwitchingEnabled: true});
  await request(watcher.actor, 'watchTargets', {targetType: 'frame'});
  let target;
  for (let attempt = 0; attempt < 100; attempt++) {
    target = packets.find(packet => packet.type === 'target-available-form' && packet.target?.url?.startsWith('moz-extension://') && packet.target?.consoleActor)?.target;
    if (target) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!target) throw Error('Firefox background target unavailable: ' + JSON.stringify({watcher, packets}));
  async function rawEvaluate(text) {
    const evaluation = await request(target.consoleActor, 'evaluateJSAsync', {text});
    for (let attempt = 0; attempt < 300; attempt++) {
      const index = packets.findIndex(packet => packet.type === 'evaluationResult' && packet.resultID === evaluation.resultID);
      if (index >= 0) {
        const result = packets.splice(index, 1)[0];
        if (result.hasException) throw Error(result.exceptionMessage);
        return result.result;
      }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw Error('Firefox evaluation did not finish.');
  }
  async function evaluate(text) {
    await rawEvaluate('globalThis.__popTestResult=undefined; (async()=>{' + text + '})().then(value=>globalThis.__popTestResult=JSON.stringify({value})).catch(error=>globalThis.__popTestResult=JSON.stringify({error:error.message}));');
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await rawEvaluate('globalThis.__popTestResult');
      if (typeof result === 'string') {
        const parsed = JSON.parse(result);
        if (parsed.error) throw Error(parsed.error);
        return parsed.value;
      }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw Error('Firefox background action timed out.');
  }
  return {url: addon.manifestURL.replace('/manifest.json', ''), evaluate, close: () => socket.end()};
}

async function checkLinkGuard(context,extensionURL,debugging){
 if (!debugging) {
   const worker=context.serviceWorkers()[0];
   await worker.evaluate(async()=>{
     for(let attempt=0;attempt<50;attempt++) {
       const rules=await chrome.declarativeNetRequest.getDynamicRules();
       if(rules.some(rule=>rule.condition.requestDomains?.includes('gmaail.com')))return;
       await new Promise(resolve=>setTimeout(resolve,100));
     }
     throw Error('Lookalike rules did not finish installing');
   });
 }
 for(const domain of ['instaagram.com','gmaail.com','gmmail.com','outllook.com','paypa1.com']) {
 const page=await context.newPage();let loads=0;
 await page.route('https://'+domain+'/**',route=>{loads++;return route.fulfill({contentType:'text/html',body:'<h1>Fictional route fixture, no real site visited.</h1>'})});
 await page.waitForTimeout(700);
 await page.goto('https://'+domain+'/fictional-link-test',{timeout:5000}).catch(()=>{});
 if(debugging){
  // Playwright deliberately excludes Firefox extension pages. Inspect the actual
  // tab/view using Mozilla's debugger, as for the other Firefox extension UI.
  let warned=false;
  for(let i=0;i<30;i++){
   warned=await debugging.evaluate("return (await browser.tabs.query({})).some(t=>t.url?.includes('/link-warning.html')); ");
   if(warned)break;await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(warned,'Firefox must show its actual extension warning tab');assert.equal(loads,0);
  await debugging.evaluate("const view=browser.extension.getViews().find(v=>v.location.pathname.endsWith('/link-warning.html'));if(!view)throw Error('Warning view missing');view.document.getElementById('continue').click();");
 }else{
  // Blocking aborts the original navigation; do not wait on its load event.
  for(let attempt=0;attempt<100 && !page.url().startsWith(extensionURL+'/link-warning.html');attempt++)
    await page.waitForTimeout(100);
  assert.ok(page.url().startsWith(extensionURL+'/link-warning.html'), 'Actual warning page must open');
  assert.equal(loads,0,'Lookalike navigation must be blocked before destination loads');
  await page.getByRole('button',{name:'I understand. Continue once.',exact:true}).click();
 }
 await page.getByRole('heading',{name:'Fictional route fixture, no real site visited.'}).waitFor();assert.equal(loads,1);
 await page.close();console.log(domain+': blocked before load; explicit continuation worked.');
 }
}

async function testBrowser(name) {
  const extension = path.join(temporary, name + '-extension');
  await cp(path.join(root, 'extension'), extension, {recursive: true});
  const manifest = JSON.parse(await readFile(path.join(extension, name === 'firefox' ? 'manifest.firefox.json' : 'manifest.json')));
  const fixtureURL = new URL(origin);
  manifest.host_permissions.push(fixtureURL.protocol + '//' + fixtureURL.hostname + '/*', '<all_urls>');
  await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  const profile = path.join(temporary, name + '-profile');
  let context;
  let extensionURL;
  let firefoxDebugger;
  const errors = [];
  try {
    if (name === 'chromium') {
      context = await chromium.launchPersistentContext(profile, {
        channel: 'chromium', headless: true, viewport: {width: 1280, height: 900},
        args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension]
      });
      const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      const workerURL = new URL(worker.url());
      extensionURL = workerURL.protocol + '//' + workerURL.host;
      await checkLinkGuard(context,extensionURL);
    } else {
      const portServer = net.createServer();
      await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
      const debugPort = portServer.address().port;
      await new Promise(resolve => portServer.close(resolve));
      const uuid = 'f6f5cd38-cc4b-4728-a17c-ec8f19905dda';
      context = await firefox.launchPersistentContext(profile, {
        headless: true, viewport: {width: 1280, height: 900}, args: ['--start-debugger-server', String(debugPort)],
        firefoxUserPrefs: {
          'devtools.debugger.remote-enabled': true, 'devtools.debugger.prompt-connection': false,
          'devtools.chrome.enabled': true, 'xpinstall.signatures.required': false,
          'extensions.allowPrivateBrowsingByDefault': true,
          'browser.download.folderList': 2,
          'browser.download.dir': path.join(root, 'output', 'pop'),
          'browser.download.useDownloadDir': true,
          'browser.helperApps.neverAsk.saveToDisk': 'text/html,image/png',
          'extensions.webextensions.uuids': JSON.stringify({'pop@strikeout.app': uuid})
        }
      });
      firefoxDebugger = await installFirefoxAddon(debugPort, extension);
      extensionURL = firefoxDebugger.url;
      await checkLinkGuard(context,extensionURL,firefoxDebugger);
      await testFirefox(context, firefoxDebugger);
      return;
    }
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const workspace = name === 'firefox' ? (context.pages().find(page => page.url().startsWith(extensionURL)) || await context.waitForEvent('page')) : await context.newPage();
    try { if (name !== 'firefox') await workspace.goto(extensionURL + '/workspace.html#watchlist', {waitUntil: 'domcontentloaded', timeout: 15000}); }
    catch (error) {
      console.log(name + ' failed navigation state:', workspace.url(), (await workspace.content()).slice(0, 700));
      throw error;
    }
    await workspace.locator('#watch-value').fill('alex@example.com');
    await workspace.locator('#watch-form button').click();
    await workspace.waitForFunction(() => document.getElementById('watch-items').children.length === 1);
    await workspace.locator('#watch-kind').selectOption('phone');
    await workspace.locator('#watch-value').fill('+1 202 555 0147');
    await workspace.locator('#watch-form button').click();
    await workspace.waitForFunction(() => document.getElementById('watch-items').children.length === 2);
    await workspace.locator('#watch-kind').selectOption('username');
    await workspace.locator('#watch-value').fill('@alex_demo');
    await workspace.locator('#watch-form button').click();
    await workspace.waitForFunction(() => document.getElementById('watch-items').children.length === 3);
    await workspace.screenshot({path: path.join(root, 'output', 'pop', 'chromium-workspace.png')});

    const page = await context.newPage();
    await page.goto(origin + '/portfolio');
    await page.waitForSelector('#strikeout-pop-pet', {state: 'attached'});
    const tabId = await workspace.evaluate(async origin => (await chrome.tabs.query({})).find(tab => tab.url?.startsWith(origin))?.id, origin);
    assert.ok(tabId, 'Fixture tab has an extension-visible id');

    async function pet(action, id) {
      return workspace.evaluate(async ({tabId, action, id}) => {
        const results = await chrome.scripting.executeScript({target: {tabId}, func: ({action, id}) => {
          const host = document.getElementById('strikeout-pop-pet');
          const root = chrome.dom.openOrClosedShadowRoot(host);
          if (action === 'click') root.getElementById(id).click();
          if (action === 'remove') root.querySelector('.warning button:last-child').click();
          if (action === 'keyboard') root.getElementById('cat').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
          return {note: globalThis.Pop.lastNote || root.getElementById('note').textContent, hidden: host.hidden, bodyHidden: root.getElementById('body').hidden, hearts: root.querySelectorAll('.heart').length, warning: root.querySelector('.warning')?.textContent || '', left: host.getBoundingClientRect().left, top: host.getBoundingClientRect().top, width: host.offsetWidth, height: host.offsetHeight, pageMenu: !!root.getElementById('scan')};
        }, args: [{action, id}]});
        return results[0].result;
      }, {tabId, action, id});
    }
    const resting = await pet('read');
    assert.equal(resting.bodyHidden, true, 'The page starts with just the small cat');
    assert.equal(resting.width, 48);
    assert.equal(resting.height, 48);
    assert.equal(resting.pageMenu, false, 'Full controls are not injected into websites');
    let patted;
    for (let index = 0; index < 7; index++) patted = await pet('click', 'cat');
    assert.match(patted.note, /seven/);
    assert.ok(patted.hearts > 0);
    assert.equal(patted.left, resting.left);
    assert.equal(patted.top, resting.top);
    await pet('click', 'minimise');
    const minimised = await pet('read');
    assert.equal(minimised.bodyHidden, true);
    assert.equal(minimised.left, resting.left, 'Minimising speech does not move the cat horizontally');
    assert.equal(minimised.top, resting.top, 'Minimising speech does not move the cat vertically');
    const catBounds = await page.locator('#strikeout-pop-pet').boundingBox();
    await page.mouse.move(catBounds.x + 32, catBounds.y + 32);
    await page.mouse.down();
    await page.mouse.move(catBounds.x - 100, catBounds.y - 100, {steps: 5});
    await page.mouse.up();
    const dragged = await pet('read');
    await workspace.evaluate(tabId => chrome.tabs.sendMessage(tabId, {type: 'POP_PET'}), tabId);
    await workspace.evaluate(tabId => chrome.tabs.sendMessage(tabId, {type: 'POP_MINIMISE'}), tabId);
    const afterDragMinimise = await pet('read');
    assert.equal(afterDragMinimise.left, dragged.left);
    assert.equal(afterDragMinimise.top, dragged.top);
    await page.screenshot({path: path.join(root, 'output', 'pop', name + '-headpats.png')});
    const beforeMove = (await pet('read')).left;
    await pet('keyboard');
    assert.ok((await pet('read')).left < beforeMove);
    await workspace.evaluate(tabId => chrome.tabs.sendMessage(tabId, {type: 'POP_SCAN'}), tabId);
    assert.equal(await page.locator('mark[data-pop-match]').count(), 3);
    assert.match((await pet('read')).note, /does not establish public visibility/);
    await workspace.evaluate(tabId => chrome.tabs.sendMessage(tabId, {type: 'POP_SCAN'}), tabId);
    assert.equal(await page.locator('mark[data-pop-match]').count(), 3, 'A second scan does not duplicate highlights');

    await page.locator('#bio').fill('Contact alex@example.com. Keep the rest.');
    await page.locator('#bio').dispatchEvent('paste');
    await page.waitForTimeout(100);
    assert.match((await pet('read')).warning, /1 watched/);
    await pet('remove');
    assert.equal(await page.locator('#bio').inputValue(), 'Contact . Keep the rest.');
    await page.locator('#rich').focus();
    await workspace.evaluate(tabId => chrome.tabs.sendMessage(tabId, {type: 'POP_DRAFT'}), tabId);
    await pet('remove');
    assert.ok(await page.locator('#rich strong').count(), 'Formatted editor preserves its structure');
    assert.ok(!(await page.locator('#rich').textContent()).includes('alex@example.com'));
    await page.locator('#password').fill('alex@example.com');
    await page.locator('#password').dispatchEvent('paste');
    assert.equal((await pet('read')).warning, '', 'Password fields are ignored');

    await page.reload();
    await page.waitForSelector('#strikeout-pop-pet', {state: 'attached'});
    assert.equal(await page.locator('#strikeout-pop-pet').count(), 1);
    await workspace.evaluate(tabId => chrome.runtime.sendMessage({type: 'POP_BRING', tabId, command: 'POP_SHOW'}), tabId);
    assert.equal(await page.locator('#strikeout-pop-pet').count(), 1);
    await workspace.evaluate(tabId => chrome.runtime.sendMessage({type: 'POP_BRING', tabId, command: 'POP_DISABLE'}), tabId);
    await page.waitForSelector('#strikeout-pop-pet[hidden]', {state: 'attached'});
    assert.equal((await pet('read')).hidden, true);
    await page.reload();
    await page.waitForSelector('#strikeout-pop-pet', {state: 'attached'});
    assert.equal((await pet('read')).hidden, true, 'Site disabling survives navigation');
    await workspace.evaluate(() => chrome.storage.local.set({disabledSites: [], snoozedUntil: Date.now() + 10000}));
    await page.waitForTimeout(100);
    assert.equal((await pet('read')).hidden, true);
    await workspace.evaluate(() => chrome.storage.local.set({snoozedUntil: 0}));
    await page.waitForTimeout(100);
    assert.equal((await pet('read')).hidden, false);
    await page.emulateMedia({reducedMotion: 'reduce'});
    const animation = await workspace.evaluate(async tabId => {
      const result = await chrome.scripting.executeScript({target: {tabId}, func: () => getComputedStyle(chrome.dom.openOrClosedShadowRoot(document.getElementById('strikeout-pop-pet')).querySelector('img')).animationName});
      return result[0].result;
    }, tabId);
    assert.equal(animation, 'none');
    await page.screenshot({path: path.join(root, 'output', 'pop', name + '-companion.png')});

    // The local fixture host is explicitly granted by the test manifest.
    await page.bringToFront();
    const reviewPromise = context.waitForEvent('page');
    reviewPromise.catch(() => {});
    const result = await workspace.evaluate(tabId => chrome.runtime.sendMessage({type: 'POP_CAPTURE', tabId}), tabId);
    assert.ok(!result?.error, result?.error);
    const review = await reviewPromise;
    await review.waitForFunction(() => document.getElementById('redaction').width > 1);
    await review.locator('#redact-x').fill('0');
    await review.locator('#redact-y').fill('0');
    await review.locator('#redact-width').fill('100');
    await review.locator('#redact-height').fill('100');
    await review.locator('#redact-add').click();
    await review.locator('#capture-incident').fill('Fictional incident');
    await review.locator('#capture-note').fill('A harmless test note.');
    await review.locator('#capture-save').click();
    await review.waitForURL(/#incidents$/);
    const saved = await review.evaluate(async () => {
      const records = await PopEvidence.all();
      const bitmap = await createImageBitmap(records[0].image);
      const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
      const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
      return {count: records.length, pixel: Array.from(context.getImageData(20, 20, 1, 1).data), keys: Object.keys(records[0])};
    });
    assert.equal(saved.count, 1);
    assert.deepEqual(saved.pixel, [20, 16, 25, 255], 'Saved blob contains opaque redaction pixels');
    assert.ok(!saved.keys.includes('screenshot'), 'No original screenshot is stored');
    await review.getByRole('button', {name: 'Export incident with screenshots'}).click();
    let downloaded;
    for (let attempt=0;attempt<50;attempt++) {
      downloaded=await review.evaluate(async()=> (await chrome.downloads.search({})).find(item=>item.state==='complete'));
      if(downloaded)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(downloaded,'Incident export completed through the browser download manager: '+JSON.stringify(await review.evaluate(()=>chrome.downloads.search({}))));
    const exported = await readFile(downloaded.filename, 'utf8');
    await writeFile(path.join(root,'output','pop',name+'-fictional-incident.html'),exported);
    await review.evaluate(async id=>{await chrome.downloads.removeFile(id);await chrome.downloads.erase({id});},downloaded.id);
    assert.match(exported, /data:image\/png;base64/);
    assert.match(exported, /A harmless test note/);
    review.on('dialog', dialog => dialog.accept());
    await review.getByRole('button', {name: 'Delete incident', exact: true}).click();
    await review.waitForFunction(async () => (await PopEvidence.all()).length === 0);
    await workspace.goto(extensionURL + '/workspace.html#chat');
    await workspace.locator('#chat-message').fill('What should I do first?');
    await workspace.locator('#chat-send').click();
    await workspace.waitForFunction(() => document.getElementById('app-status').textContent.includes('Settings'));
    await workspace.goto(extensionURL + '/panel.html');
    await workspace.evaluate(({tabId, origin}) => {
      activeTab = {id: tabId, url: origin};
      document.getElementById('site').textContent = 'Here: ' + new URL(origin).hostname;
      chrome.permissions.request = async () => false;
    }, {tabId, origin});
    await workspace.locator('.popup').screenshot({path: path.join(root, 'output', 'pop', 'chromium-popup.png')});
    const popupBounds = await workspace.locator('.popup').boundingBox();
    assert.equal(popupBounds.width, 220);
    assert.ok(popupBounds.height <= 170, 'Default popup stays genuinely compact');
    await workspace.locator('summary').click();
    await workspace.locator('#allow-site').click();
    await workspace.waitForFunction(() => document.getElementById('status').textContent.includes('Permission was not granted'));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(name + ': installed extension, petting, scanning, paste/draft removal, password exclusion, persistence, disabling, snooze, reduced motion, capture, flattened redaction, export, deletion and unavailable AI passed.');
  } finally { firefoxDebugger?.close(); await context?.close(); }
}

async function testFirefox(context, debugging) {
  // Playwright's Firefox backend excludes extension pages. Drive those pages via
  // the add-on's own debugger; ordinary website interactions still use Playwright.
  const evaluate = debugging.evaluate;
  await evaluate("await chrome.storage.local.set({watchlist:[{id:'a',kind:'email',value:'alex@example.com'},{id:'b',kind:'phone',value:'+1 202 555 0147'},{id:'c',kind:'username',value:'@alex_demo'}]});await browser.tabs.create({url:browser.runtime.getURL('workspace.html#watchlist')});");
  const page = await context.newPage();
  await page.goto(origin + '/portfolio');
  await page.waitForSelector('#strikeout-pop-pet', {state: 'attached'});
  const tabId = await evaluate('return (await browser.tabs.query({})).find(tab=>tab.url?.startsWith(' + JSON.stringify(origin) + ')).id;');
  async function pet(action, id) {
    return evaluate('const result=await browser.scripting.executeScript({target:{tabId:' + tabId + '},func:({action,id})=>{const host=document.getElementById("strikeout-pop-pet");const root=host.openOrClosedShadowRoot;if(action==="click")root.getElementById(id).click();if(action==="remove")root.querySelector(".warning button:last-child").click();return {note:root.getElementById("note").textContent,hidden:host.hidden,warning:root.querySelector(".warning")?.textContent||""};},args:[' + JSON.stringify({action,id}) + ']});if(result[0].error)throw Error(result[0].error.message);return result[0].result;');
  }
  const resting = await page.locator('#strikeout-pop-pet').boundingBox();
  assert.equal(resting.width, 48); assert.equal(resting.height, 48);
  for (let index = 0; index < 7; index++) await pet('click', 'cat');
  assert.match((await pet('read')).note, /seven/);
  await pet('click', 'minimise');
  const minimised = await page.locator('#strikeout-pop-pet').boundingBox();
  assert.equal(minimised.x, resting.x); assert.equal(minimised.y, resting.y);
  await evaluate('await browser.tabs.sendMessage(' + tabId + ',{type:"POP_SCAN"});');
  assert.equal(await page.locator('mark[data-pop-match]').count(), 3);
  await page.locator('#bio').fill('Contact alex@example.com. Keep the rest.');
  await page.locator('#bio').dispatchEvent('paste');
  await page.waitForTimeout(100);
  assert.match((await pet('read')).warning, /1 watched/);
  await pet('remove');
  assert.equal(await page.locator('#bio').inputValue(), 'Contact . Keep the rest.');
  await page.locator('#rich').focus();
  await evaluate('await browser.tabs.sendMessage(' + tabId + ',{type:"POP_DRAFT"});');
  await pet('remove');
  assert.equal(await page.locator('#rich strong').count(), 1);
  await page.locator('#password').fill('alex@example.com');
  await page.locator('#password').dispatchEvent('paste');
  assert.equal((await pet('read')).warning, '');
  await evaluate('await browser.tabs.sendMessage(' + tabId + ',{type:"POP_DISABLE"});');
  await page.waitForSelector('#strikeout-pop-pet[hidden]', {state: 'attached'});
  await page.reload();
  await page.waitForSelector('#strikeout-pop-pet', {state: 'attached'});
  assert.equal((await pet('read')).hidden, true);
  await evaluate('await chrome.storage.local.set({disabledSites:[],snoozedUntil:Date.now()+10000});');
  assert.equal((await pet('read')).hidden, true);
  await evaluate('await chrome.storage.local.set({snoozedUntil:0});');
  await page.waitForSelector('#strikeout-pop-pet:not([hidden])', {state: 'attached'});
  await page.screenshot({path: path.join(root,'output','pop','firefox-companion.png')});
  const chatError = await evaluate('const view=browser.extension.getViews().find(view=>view.location.pathname.endsWith("workspace.html"));view.document.getElementById("chat-message").value="What should I do first?";view.document.getElementById("chat-form").dispatchEvent(new view.Event("submit",{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,200));return view.document.getElementById("app-status").textContent;');
  assert.match(chatError,/Settings/);
  const revoked = await evaluate('await browser.storage.local.set({aiConsent:true});try{await chat("Test question","");return "unexpected success";}catch(error){return error.message;}finally{await browser.storage.local.set({aiConsent:false});}');
  assert.match(revoked,/Firefox.*permission is off/);
  await page.bringToFront();
  await evaluate('await captureEvidence(' + tabId + ');');
  await page.waitForTimeout(500);
  const review = 'const view=browser.extension.getViews().find(view=>view.location.hash.startsWith("#capture/"));if(!view)throw Error("Review page not found");';
  const saved = await evaluate(review + 'const doc=view.document;doc.getElementById("redact-width").value="100";doc.getElementById("redact-height").value="100";doc.getElementById("redact-add").click();doc.getElementById("capture-incident").value="Fictional Firefox incident";doc.getElementById("capture-note").value="A harmless Firefox test note.";await doc.getElementById("capture-save").onclick();const records=await view.PopEvidence.all();const bitmap=await createImageBitmap(records[0].image);const canvas=document.createElement("canvas");canvas.width=100;canvas.height=100;const ctx=canvas.getContext("2d");ctx.drawImage(bitmap,0,0);return {count:records.length,pixel:Array.from(ctx.getImageData(20,20,1,1).data),keys:Object.keys(records[0])};');
  assert.equal(saved.count,1);
  assert.deepEqual(saved.pixel,[20,16,25,255]);
  assert.ok(!saved.keys.includes('screenshot'));
  const downloadId = await evaluate('const view=browser.extension.getViews().find(view=>view.location.hash==="#incidents");return await view.PopEvidence.exportIncident(await view.PopEvidence.all());');
  let downloaded;
  for (let attempt=0;attempt<50;attempt++) {
    downloaded=await evaluate('return (await browser.downloads.search({id:'+downloadId+'}))[0];');
    if(downloaded?.state==='complete')break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(downloaded?.state,'complete');
  const exported=await readFile(downloaded.filename,'utf8');
  assert.match(exported || '', /data:image\/png;base64/);
  assert.match(exported || '', /A harmless Firefox test note/);
  await writeFile(path.join(root,'output','pop','firefox-fictional-incident.html'),exported);
  await evaluate('await browser.downloads.removeFile('+downloadId+');await browser.downloads.erase({id:'+downloadId+'});');
  await evaluate('const view=browser.extension.getViews().find(view=>view.location.hash==="#incidents");await view.PopEvidence.clear();if((await view.PopEvidence.all()).length)throw Error("Deletion failed");');
  console.log('firefox: real installed extension, petting, scanning, sharing guard, formatted editor, password exclusion, persistence, site disabling, snooze, capture, flattened redaction, actual export, deletion and unavailable AI passed.');
}

try {
  for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ['chromium', 'firefox']) await testBrowser(name);
} finally {
  await new Promise(resolve => server.close(resolve));
  // Only delete the exact temporary directory created above.
  if (path.dirname(temporary) === os.tmpdir() && path.basename(temporary).startsWith('pop-browser-test-')) await rm(temporary, {recursive: true, force: true});
}
