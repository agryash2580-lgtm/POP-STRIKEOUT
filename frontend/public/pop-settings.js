const el = id => document.getElementById(id);
let prefs;
function bridge(action, value) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { window.removeEventListener('message', listen); reject(Error('Pop did not respond. Enable it on this website in THIS browser/profile, then refresh this page. See Extension not detected below.')); }, 12000);
    function listen(event) {
      if(event.source !== window || event.origin !== location.origin || event.data?.type !== 'POP_SETTINGS_RESULT' || event.data.id !== id) return;
      clearTimeout(timer); window.removeEventListener('message', listen);
      event.data.error ? reject(Error(event.data.error)) : resolve(event.data.result);
    }
    window.addEventListener('message', listen);
    window.postMessage({type:'STRIKEOUT_POP_SETTINGS', id, action, value}, location.origin);
  });
}
async function refresh() {
  prefs = await bridge('get');
  el('preferences').hidden = false;
  el('watchlist').value = prefs.watchlist.map(x => x.kind + ': ' + x.value).join('\n');
  el('guard').checked = prefs.sharingGuard;
  el('ai').checked = prefs.aiConsent;
  el('paired').textContent = prefs.paired ? 'Account token saved. Connect again if your login/security settings changed.' : 'Not paired with an account yet.';
}
async function run(task) {
  for(const b of document.querySelectorAll('button')) b.disabled = true;
  el('status').textContent = 'Working… Approve the extension permission prompt if shown.';
  try { await task(); } catch(error) { el('status').textContent = error.message; }
  finally { for(const b of document.querySelectorAll('button')) b.disabled = false; }
}
el('connect').onclick = () => run(async () => {
  const response = await fetch('/api/pop/connect-code', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const result = await response.json();
  if(!response.ok) throw Error(result.error || 'Sign in first using Open account / sign in, then return here.');
  await bridge('pair', {code:result.code});
  await refresh();
  el('status').textContent = 'Pop is connected to this account. Saved captures can now be synced from Pop using Sync to website library. Enable optional AI chat below if wanted.';
});
el('refresh').onclick = () => run(async () => { await refresh(); el('status').textContent = 'Extension settings loaded.'; });
el('save').onclick = () => run(async () => {
  const watchlist = el('watchlist').value.split('\n').map(x=>x.trim()).filter(Boolean).map(line => {
    const match = /^(email|phone|username):\s*(.+)$/.exec(line);
    if(!match) throw Error('Use email:, phone: or username: before every identifier.');
    return {id:crypto.randomUUID(),kind:match[1],value:match[2].trim()};
  });
  await bridge('save', {...prefs,watchlist,sharingGuard:el('guard').checked,aiConsent:el('ai').checked});
  await refresh(); el('status').textContent = 'Settings saved to your installed Pop.';
});
el('permission').onclick = () => run(async () => {await bridge('allow-ai');el('status').textContent='Permission window opened. Review it there, then return here.';});
el('disconnect').onclick = () => run(async () => {await bridge('disconnect');await refresh();el('status').textContent='Pop disconnected from your account.';});
