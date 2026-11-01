document.getElementById('generate').onclick = async () => {
  const button = document.getElementById('generate');
  const status = document.getElementById('status');
  button.disabled = true;
  try {
    let response = await fetch('/api/auth/me');
    let result = await response.json();
    if (!result.user) {
      response = await fetch('/api/demo/start', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
      if (!response.ok) throw Error('Could not start a guest workspace. Open STRIKEOUT and try again.');
    }
    response = await fetch('/api/pop/connect-code', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
    result = await response.json();
    if (!response.ok) throw Error(result.error || 'Could not generate a pairing code.');
    const output = document.getElementById('code');
    output.textContent = result.code;
    output.hidden = false;
    status.textContent = 'Select and copy this code. Expires ' + new Date(result.expires).toLocaleTimeString() + '.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
};
