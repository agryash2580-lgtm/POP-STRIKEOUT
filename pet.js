(() => {
  const existing = document.getElementById('strikeout-pop-pet');
  if (existing?.dataset.popVersion === '2.1.1') return;
  existing?.remove();
  const Pop = globalThis.Pop;
  const SIZE = 48;
  let host, root, drag, notice;
  let moved = false;
  let pats = 0;
  let lastPet = 0;
  let speechTimer, snoozeTimer;
  let capturedHidden = false;
  let lastScan = null;
  const get = id => root.getElementById(id);
  const jokes = [
    'Excellent. Finally, competent management.',
    'Cybersecurity department accepting head pats.',
    'Payment received. In head pats. Obviously.',
    'My qualifications? Soft. Available.',
    'This meeting could have been a head pat.'
  ];

  // Only this fixed 48px square defines Pop's position. Speech is an overlay.
  function position(left, top) {
    host.style.left = Math.round(Math.max(0, Math.min(innerWidth - SIZE, left))) + 'px';
    host.style.top = Math.round(Math.max(0, Math.min(innerHeight - SIZE, top))) + 'px';
    const rect = host.getBoundingClientRect();
    get('body').style.left = rect.left > 160 ? 'auto' : '0';
    get('body').style.right = rect.left > 160 ? '0' : 'auto';
    get('body').style.bottom = rect.top > 90 ? '56px' : 'auto';
    get('body').style.top = rect.top > 90 ? 'auto' : '56px';
  }

  function savePosition() {
    const rect = host.getBoundingClientRect();
    return PopAPI.storage.local.set({petPosition: {x: rect.left / innerWidth, y: rect.top / innerHeight}});
  }

  function minimise() {
    clearTimeout(speechTimer);
    get('body').hidden = true;
    // Do not touch host coordinates here. Hiding speech must never move the cat.
  }

  Pop.say = function (text, shortText = text) {
    Pop.lastNote = text;
    if (!host || !Pop.active) return;
    get('note').textContent = shortText;
    get('body').hidden = false;
    const rect = host.getBoundingClientRect();
    position(rect.left, rect.top);
    clearTimeout(speechTimer);
    speechTimer = setTimeout(minimise, 4500);
  };

  function petPop() {
    const now = Date.now();
    pats = now - lastPet < 3000 ? pats + 1 : 1;
    lastPet = now;
    Pop.say(pats >= 7 ? "That's seven. Your tabs remain a disaster." : pats >= 4 ? 'You may continue. I cancelled my next meeting.' : jokes[Math.floor(Math.random() * jokes.length)]);
    get('cat').classList.remove('petted');
    void get('cat').offsetWidth;
    get('cat').classList.add('petted');
    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.textContent = '♥';
    get('cat').append(heart);
    setTimeout(() => heart.remove(), 900);
  }

  function closeNotice() { notice?.remove(); notice = null; }

  Pop.noticeSharing = function (editor, matches) {
    closeNotice();
    Pop.lastNote = matches.length + ' watched item(s) found in the selected field. Review the warning beside it.';
    notice = document.createElement('aside');
    notice.className = 'warning';
    notice.setAttribute('role', 'alert');
    const title = document.createElement('strong');
    title.className = 'titlebar';
    title.textContent = 'Pop.exe — Sharing check';
    const text = document.createElement('p');
    text.textContent = matches.length + ' watched item(s) in this field. Keep them? The site may already have received the text.';
    const keep = document.createElement('button');
    keep.textContent = 'Keep'; keep.onclick = closeNotice;
    const remove = document.createElement('button');
    remove.textContent = 'Remove matched information';
    remove.onclick = () => {
      try { Pop.removeFromEditor(editor); closeNotice(); Pop.say('Matched information removed from this field. Anything already transmitted remains with the website.', 'Removed from this field. Already-sent text cannot be recalled.'); }
      catch (error) { Pop.say(error.message); }
    };
    notice.append(title, text, keep, remove);
    root.append(notice);
    const rect = editor.getBoundingClientRect();
    notice.style.left = Math.max(8, Math.min(innerWidth - 292, rect.left)) + 'px';
    notice.style.top = Math.max(8, Math.min(innerHeight - 160, rect.bottom + 8)) + 'px';
  };

  async function scan() {
    const settings = await PopAPI.storage.local.get('watchlist');
    if (!settings.watchlist?.length) {
      Pop.say('Add an email, phone or username in the extension’s Watchlist first.', 'Add your identifiers in Pop’s toolbar → Watchlist.');
      return {ok: true, note: Pop.lastNote, count: 0};
    }
    lastScan = Pop.scanPage(settings.watchlist);
    Pop.say(lastScan.count + ' match(es) found on this page.' + (lastScan.limited ? ' Large page: check limited.' : '') + ' This does not establish public visibility. Images, PDFs and embedded frames are not checked.', lastScan.count + ' watched match(es) here. Details in the toolbar.');
    return {ok: true, note: Pop.lastNote, ...lastScan};
  }

  function applyPreferences(settings) {
    const disabled = (settings.disabledSites || []).includes(location.hostname);
    const snoozed = Number(settings.snoozedUntil || 0) > Date.now();
    Pop.active = !disabled && !snoozed;
    host.hidden = !Pop.active;
    if (!Pop.active) { minimise(); closeNotice(); Pop.clearHighlights(); }
    clearTimeout(snoozeTimer);
    if (snoozed && !disabled) snoozeTimer = setTimeout(() => PopAPI.storage.local.get(['disabledSites', 'snoozedUntil']).then(applyPreferences), Math.min(2147483647, settings.snoozedUntil - Date.now() + 50));
  }

  async function disableSite() {
    const settings = await PopAPI.storage.local.get('disabledSites');
    await PopAPI.storage.local.set({disabledSites: [...new Set([...(settings.disabledSites || []), location.hostname])]});
  }

  async function start() {
    const settings = await PopAPI.storage.local.get(['disabledSites', 'snoozedUntil', 'petPosition']);
    if (document.getElementById('strikeout-pop-pet')) return;
    host = document.createElement('div');
    host.id = 'strikeout-pop-pet';
    host.dataset.popVersion = '2.1.1';
    host.style.cssText = 'position:fixed;width:48px;height:48px;z-index:2147483647;';
    root = host.attachShadow({mode: 'closed'});
    root.innerHTML = `<style>
      :host{all:initial}*{box-sizing:border-box}[hidden]{display:none!important}
      button{font:11px Tahoma,Arial,sans-serif;color:#000;cursor:pointer}
      button:focus-visible{outline:1px dotted #000;outline-offset:2px}
      #cat{position:relative;display:block;width:48px;height:48px;border:0;padding:0;background:none;touch-action:none;cursor:grab}
      #cat:active{cursor:grabbing}#cat img{width:48px;height:48px;image-rendering:pixelated;pointer-events:none;animation:idle 6s ease-in-out infinite;transform-origin:50% 90%}
      #body{position:absolute;width:160px;max-width:calc(100vw - 16px);background:#ffffe1;color:#000;border:1px solid #000;padding:5px 19px 5px 6px;box-shadow:1px 1px #0003;font:10px/1.4 Tahoma,Arial,sans-serif}
      #note{margin:0;overflow-wrap:anywhere}#minimise{position:absolute;right:4px;top:4px;border:0;background:transparent;padding:0 2px;font-size:13px;line-height:14px}
      .heart{position:absolute;left:18px;top:8px;color:#d52c57;font:15px Arial;pointer-events:none;animation:heart .85s ease-out forwards}
      .petted img{animation:pat .5s ease-in-out!important}
      .warning{position:fixed;z-index:2;width:284px;max-width:calc(100vw - 16px);background:#c0c0c0;color:#000;box-shadow:inset 1px 1px #fff,inset -1px -1px #000,inset 2px 2px #dfdfdf,inset -2px -2px #808080;padding:3px;font:11px/1.4 Tahoma,Arial,sans-serif}
      .titlebar{display:block;background:linear-gradient(90deg,#000080,#1084d0);color:#fff;padding:3px 5px;font-size:11px}.warning p{margin:10px 8px}.warning button{margin:0 3px 7px 6px;background:#c0c0c0;border:0;padding:5px 8px;box-shadow:inset 1px 1px #fff,inset -1px -1px #000,inset 2px 2px #dfdfdf,inset -2px -2px #808080}
      @keyframes idle{0%,65%,100%{transform:translateY(0) rotate(0)}40%{transform:translateY(-2px)}75%{transform:rotate(-3deg)}80%{transform:rotate(2deg)}}
      @keyframes pat{30%{transform:scale(1.12,.85) rotate(-6deg)}65%{transform:scale(.96,1.05) rotate(5deg)}}
      @keyframes heart{to{transform:translateY(-48px);opacity:0}}
      @media(prefers-reduced-motion:reduce){#cat img,.petted img,.heart{animation:none!important}}
    </style><div id="body" role="status" hidden><p id="note"></p><button id="minimise" aria-label="Minimise speech">×</button></div><button id="cat" aria-label="Pet Pop; drag or use arrow keys to move" title="Click for head pats. Drag to move. Tools live in the extension icon."><img alt="Pop the pixel cat"></button>`;
    get('cat').querySelector('img').src = PopAPI.runtime.getURL('pop.png');
    document.documentElement.append(host);
    position(settings.petPosition ? settings.petPosition.x * innerWidth : innerWidth - SIZE - 18, settings.petPosition ? settings.petPosition.y * innerHeight : innerHeight - SIZE - 18);
    applyPreferences(settings);
    get('minimise').onclick = minimise;
    get('cat').onclick = () => { if (!moved) petPop(); };
    get('cat').addEventListener('pointerdown', event => {
      const rect = host.getBoundingClientRect();
      drag = {x: event.clientX, y: event.clientY, left: rect.left, top: rect.top}; moved = false;
      get('cat').setPointerCapture(event.pointerId);
    });
    get('cat').addEventListener('pointermove', event => {
      if (!drag) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
      if (moved) { minimise(); position(drag.left + dx, drag.top + dy); }
    });
    get('cat').addEventListener('pointerup', () => { if (moved) savePosition().catch(console.error); drag = null; });
    get('cat').addEventListener('pointercancel', () => { drag = null; });
    get('cat').addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') moved = false;
      const offsets = {ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12]};
      if (!offsets[event.key]) return;
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      minimise(); position(rect.left + offsets[event.key][0], rect.top + offsets[event.key][1]); savePosition().catch(console.error);
    });
    window.addEventListener('resize', () => { const rect = host.getBoundingClientRect(); position(rect.left, rect.top); closeNotice(); });
    PopAPI.storage.onChanged.addListener(changes => {
      if (changes.disabledSites || changes.snoozedUntil) PopAPI.storage.local.get(['disabledSites', 'snoozedUntil']).then(applyPreferences);
    });
    PopAPI.runtime.onMessage.addListener((message, sender, reply) => {
      const result = () => ({ok: true, version: '2.1.1', note: Pop.lastNote || '', count: lastScan?.count || 0});
      if (message.type === 'POP_PING' || message.type === 'POP_STATE') reply(result());
      if (message.type === 'POP_SCAN') { scan().then(reply).catch(error => reply({error: error.message})); return true; }
      if (message.type === 'POP_DRAFT') { Pop.checkDraft(); reply(result()); }
      if (message.type === 'POP_SHOW') { minimise(); reply(result()); }
      if (message.type === 'POP_MINIMISE') { minimise(); reply({...result(), note: 'Speech minimised. Pop stays where you put him.'}); }
      if (message.type === 'POP_PET') {
        if (!Pop.active) reply({error: 'Pop is snoozed or disabled here. Choose Show Pop to wake him.'});
        else { petPop(); reply(result()); }
      }
      if (message.type === 'POP_NEXT' || message.type === 'POP_PREVIOUS') { Pop.lastNote = Pop.nextHighlight(message.type === 'POP_NEXT' ? 1 : -1); reply(result()); }
      if (message.type === 'POP_CLEAR') { Pop.clearHighlights(); lastScan = null; minimise(); reply({ok: true, count: 0, note: 'Highlights cleared.'}); }
      if (message.type === 'POP_SNOOZE') { PopAPI.storage.local.set({snoozedUntil: Date.now() + 300000}).then(() => reply({...result(), note: 'Snoozing for five minutes. Show Pop wakes him.'})).catch(error => reply({error: error.message})); return true; }
      if (message.type === 'POP_DISABLE') { disableSite().then(() => reply({...result(), note: 'Pop is disabled on this site. Show Pop re-enables him.'})).catch(error => reply({error: error.message})); return true; }
      if (message.type === 'POP_BEFORE_CAPTURE') {
        capturedHidden = host.hidden; host.hidden = true; closeNotice(); Pop.clearHighlights(); lastScan = null;
        reply({selectedText: String(window.getSelection() || '').slice(0, 12000)});
      }
      if (message.type === 'POP_AFTER_CAPTURE') { host.hidden = capturedHidden || !Pop.active; reply({ok: true}); }
    });
  }
  return start().catch(console.error);
})();
