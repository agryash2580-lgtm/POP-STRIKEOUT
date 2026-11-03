// Same-origin JSON requests. Never retry a write automatically.
/**
 * @param {string} path
 * @param {{method?: string, body?: unknown, timeoutMs?: number, fetcher?: typeof fetch}} [options]
 * @returns {Promise<Record<string, any>>}
 */
export async function requestJSON(path, {
  method = 'GET', body, timeoutMs = 20000, fetcher = fetch,
} = {}) {
  if (typeof path !== 'string' || !path.startsWith('/api/') || path.includes('\\') ||
      path.includes('//') || path.split(/[?#]/, 1)[0].split('/').some(segment => segment === '.' || segment === '..'))
    throw Error('Only StrikeOut API requests are supported.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 110000)
    throw Error('Invalid request deadline.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(path, {
      method, credentials: 'same-origin', signal: controller.signal,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw Object.assign(Error('StrikeOut returned an unreadable response. Please retry; no result is assumed.'), { code: 'INVALID_RESPONSE' });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw Object.assign(Error('StrikeOut returned an unexpected response. Please retry; no result is assumed.'), { code: 'INVALID_RESPONSE' });
    if (!response.ok) throw Object.assign(Error(typeof data.error === 'string' ? data.error : 'The request could not be completed.'), {
      status: response.status, code: data.code || 'REQUEST_FAILED',
    });
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw Object.assign(Error('This check took too long. No conclusion was reached. Check your connection and retry, or use the fictional offline demo.'), { code: 'REQUEST_TIMEOUT' });
    if (error instanceof TypeError) throw Object.assign(Error('StrikeOut could not be reached. Check your connection and retry, or use the fictional offline demo.'), { code: 'NETWORK_UNAVAILABLE' });
    throw error;
  } finally { clearTimeout(timer); }
}
