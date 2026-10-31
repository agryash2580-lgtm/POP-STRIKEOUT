// Background code bridges the page companion and privileged browser APIs.
if (typeof importScripts === 'function') importScripts('shared.js');
const Pop = globalThis.Pop;
let scriptUpdate = Promise.resolve();

function syncScripts() {
  // Permission events and a toolbar click can arrive together. Serialize updates.
  scriptUpdate = scriptUpdate.catch(() => {}).then(updateScripts);
  return scriptUpdate;
}

async function updateScripts() {
  const permissions = await PopAPI.permissions.getAll();
  const allowed = [];
  for (const origin of permissions.origins || []) {
    if (origin === '<all_urls>') allowed.push('https://*/*', 'http://*/*');
    else if (/^https?:/.test(origin)) allowed.push(origin);
  }
  const matches = [...new Set(allowed)];
  await PopAPI.scripting.unregisterContentScripts({ids: ['pop-companion']}).catch(() => {});
  if (matches.length) await PopAPI.scripting.registerContentScripts([{
    id: 'pop-companion', matches, js: Pop.scriptFiles,
    runAt: 'document_idle', persistAcrossSessions: true, allFrames: false
  }]);
}

PopAPI.runtime.onInstalled.addListener(async () => {
  await PopAPI.contextMenus.removeAll();
  PopAPI.contextMenus.create({id: 'pop-inspect', title: 'Inspect this link with Pop', contexts: ['link']});
  syncScripts().catch(console.error);
});
PopAPI.runtime.onStartup.addListener(() => syncScripts().catch(console.error));
PopAPI.permissions.onAdded.addListener(() => syncScripts().catch(console.error));
PopAPI.permissions.onRemoved.addListener(() => syncScripts().catch(console.error));
PopAPI.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'pop-inspect') PopAPI.storage.session.set({inspectedLink: info.linkUrl || ''}).then(() => openWorkspace('links'));
});

function openWorkspace(section) {
  return PopAPI.tabs.create({url: PopAPI.runtime.getURL('workspace.html#' + section)});
}

async function bringPop(tabId, command) {
  let ready;
  try { ready = await PopAPI.tabs.sendMessage(tabId, {type: 'POP_PING'}); } catch {}
  if (!ready || ready.version !== PopAPI.runtime.getManifest().version) await PopAPI.scripting.executeScript({target: {tabId}, files: Pop.scriptFiles});
  if (command) return PopAPI.tabs.sendMessage(tabId, {type: command});
  return {ok: true};
}

async function captureEvidence(tabId) {
  const tab = await PopAPI.tabs.get(tabId);
  if (!/^https?:/.test(tab.url || '')) throw Error('Use an ordinary website for evidence capture.');
  const active = await PopAPI.tabs.query({active: true, windowId: tab.windowId});
  if (active[0]?.id !== tab.id) throw Error('The active tab changed. Select the page and try again.');
  let metadata = {selectedText: ''};
  let hasPet = false;
  try {
    const response = await PopAPI.tabs.sendMessage(tabId, {type: 'POP_BEFORE_CAPTURE'});
    if (response) { metadata = response; hasPet = true; }
  } catch {}
  let screenshot;
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    screenshot = await PopAPI.tabs.captureVisibleTab(tab.windowId, {format: 'png'});
  } finally {
    if (hasPet) await PopAPI.tabs.sendMessage(tabId, {type: 'POP_AFTER_CAPTURE'}).catch(() => {});
  }
  const after = await PopAPI.tabs.query({active: true, windowId: tab.windowId});
  const afterTab = await PopAPI.tabs.get(tabId);
  if (after[0]?.id !== tabId || afterTab.url !== tab.url) throw Error('The page changed during capture. Please retry.');
  const id = crypto.randomUUID();
  await PopAPI.storage.session.set({['capture:' + id]: {
    screenshot, address: Pop.cleanAddress(tab.url), title: tab.title || '',
    capturedAt: new Date().toISOString(), selectedText: String(metadata.selectedText || '').slice(0, 12000)
  }});
  await openWorkspace('capture/' + id);
  return {ok: true};
}

async function serverRequest(path, body, token) {
  const settings = await PopAPI.storage.local.get(['server']);
  const server = settings.server || Pop.defaultServer;
  const response = await fetch(server + path, {
    method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})},
    body: JSON.stringify(body), signal: AbortSignal.timeout(25000)
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'The server could not complete that request.');
  return result;
}

async function chat(message, pageAddress) {
  const settings = await PopAPI.storage.local.get(['aiConsent', 'popToken']);
  if (!settings.aiConsent) throw Error('Review the AI disclosure and enable chat in Settings first.');
  if (typeof browser !== 'undefined' && browser.runtime.getBrowserInfo) {
    const permitted = await browser.permissions.contains({data_collection: ['personalCommunications', 'websiteContent']});
    if (!permitted) throw Error('Firefox’s AI permission is off. Re-enable AI chat in Settings.');
  }
  if (!settings.popToken) throw Error('Connect Pop to STRIKEOUT in Settings first.');
  const session = await PopAPI.storage.session.get(['chatHistory']);
  const history = session.chatHistory || [];
  const result = await serverRequest('/api/pop/chat', {
    message, history: history.slice(-8), pageAddress: Pop.cleanAddress(pageAddress || '')
  }, settings.popToken);
  const next = [...history, {role: 'user', text: message}, {role: 'assistant', text: result.text}].slice(-12);
  await PopAPI.storage.session.set({chatHistory: next});
  return {text: result.text};
}

async function handleMessage(message, sender) {
  // The page companion gets only narrow actions, never arbitrary server access.
  if (message.type === 'POP_OPEN') return openWorkspace(['watchlist', 'settings', 'incidents', 'chat'].includes(message.section) ? message.section : 'chat').then(() => ({ok: true}));
  if (message.type === 'POP_CHAT_WINDOW') {
    await PopAPI.windows.create({url: PopAPI.runtime.getURL('workspace.html#chat'), type: 'popup', width: 400, height: 540});
    return {ok: true};
  }
  if (!sender.url?.startsWith(PopAPI.runtime.getURL(''))) throw Error('Open this tool from the Pop toolbar.');
  switch (message.type) {
    case 'POP_BRING': return bringPop(message.tabId, message.command);
    case 'POP_SYNC': await syncScripts(); return {ok: true};
    case 'POP_CAPTURE': return captureEvidence(message.tabId);
    case 'POP_PAIR': {
      const result = await serverRequest('/api/pop/pair', {code: message.code});
      await PopAPI.storage.local.set({popToken: result.token});
      return {ok: true};
    }
    case 'POP_DISCONNECT': {
      const settings = await PopAPI.storage.local.get('popToken');
      if (settings.popToken) await serverRequest('/api/pop/disconnect', {}, settings.popToken);
      await PopAPI.storage.local.remove('popToken');
      await PopAPI.storage.session.remove('chatHistory');
      return {ok: true};
    }
    case 'POP_CHAT': return chat(String(message.message || '').slice(0, 3000), message.pageAddress);
    default: throw Error('Unknown Pop action.');
  }
}

PopAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type?.startsWith('POP_') || ['POP_PING', 'POP_SCAN', 'POP_DRAFT', 'POP_BEFORE_CAPTURE', 'POP_AFTER_CAPTURE', 'POP_SHOW'].includes(message.type)) return;
  handleMessage(message, sender).then(sendResponse).catch(error => sendResponse({error: error.message || 'Pop could not complete that action.'}));
  return true;
});
