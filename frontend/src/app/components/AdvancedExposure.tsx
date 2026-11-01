import { ResultLink, RiskSummary } from "./LinkRisk";
import React, { useEffect, useRef, useState } from 'react';

export function AdvancedExposure({ capabilities }: { capabilities: any }) {
  const [tool, setTool] = useState('dorks');
  const [domain, setDomain] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [template, setTemplate] = useState('references');
  const [mode, setMode] = useState('auto');
  const [approved, setApproved] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  useEffect(() => {
    const reset = () => {
      epoch.current++; setApproved(false); setResult(null); setError('');
      setDomain(''); setIdentifier(''); setImageUrl(''); setBusy(false);
    };
    window.addEventListener('strikeout-auth-changed', reset);
    return () => { epoch.current++; window.removeEventListener('strikeout-auth-changed', reset); };
  }, []);
  const automatic = mode !== 'handoff' && capabilities?.providers?.serpapi;
  const provider = tool === 'dorks' ? 'google_search' : 'google_lens';
  async function run(event: React.FormEvent) {
    event.preventDefault(); if (busy || !approved || !capabilities) return;
    const current = epoch.current; setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/osint/' + (tool === 'dorks' ? 'dorks' : 'images/reverse'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({
          ...(tool === 'dorks' ? { domain, identifier, templates: [template] } : { imageUrl }),
          mode, consent: { selfOwned: true, version: '1', providers: automatic ? ['serpapi', provider] : [provider] },
        }),
      });
      const data = await response.json(); if (!response.ok) throw Error(data.error || 'Search could not be prepared.');
      if (current === epoch.current) setResult(data);
    } catch (e: any) { if (current === epoch.current) setError(e.message); }
    finally { if (current === epoch.current) setBusy(false); }
  }
  return <section aria-label="Google and reverse-image searches" className="step-card">
    <h2>Search Google / reverse-image lookup</h2>
    <p>Search your own public information on a chosen domain, or look for copies and visually similar images. Data retrieval is a separate feature.</p>
    {!capabilities && <p className="mini-note">Sign in through Cases &amp; Reports before using these tools.</p>}
    <form onSubmit={run}><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
      <label>Search tool<select value={tool} onChange={e => { epoch.current++; setTool(e.target.value); setApproved(false); setResult(null); setError(''); setBusy(false); }}>
        <option value="dorks">Domain-scoped Google searches</option><option value="images">Reverse-image lookup</option>
      </select></label>
      {tool === 'dorks' ? <>
        <label>Domain to check<input value={domain} required maxLength={253} placeholder="example.org" onChange={e => { setDomain(e.target.value); setApproved(false); setResult(null); }} /></label>
        <label>Your name, email, username or phone<input value={identifier} required minLength={3} maxLength={254} onChange={e => { setIdentifier(e.target.value); setApproved(false); setResult(null); }} /></label>
        <label>What to look for<select value={template} onChange={e => { setTemplate(e.target.value); setApproved(false); setResult(null); }}>
          {(capabilities?.dorkTemplates || [{ id: 'references', label: 'Exact public reference' }, { id: 'pdf', label: 'PDF references' }]).map((x: any) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select></label>
        <p className="mini-note">Uses site: to limit the domain, quotes for your exact identifier and optional filetype:/page filters. No passwords, webcams or credential dumps are searched.</p>
      </> : <>
        <label>Public image URL<input type="url" required maxLength={2000} value={imageUrl} placeholder="https://example.org/my-image.jpg" onChange={e => { setImageUrl(e.target.value); setApproved(false); setResult(null); }} /></label>
        <p className="mini-note">Use an image you own or are authorized to check. Public HTTPS URLs only; no private or signed links. Similarity is not identity or location verification. For a local file, you can <a href="https://lens.google.com/" target="_blank" rel="noopener noreferrer">open Google Lens</a> and choose the file there yourself; Strikeout does not upload it.</p>
      </>}
      <label>Search method<select value={mode} onChange={e => { setMode(e.target.value); setApproved(false); setResult(null); }}>
        <option value="auto">{capabilities?.providers?.serpapi ? 'Automatic results, with free Google fallback' : 'Free Google handoff (automatic provider not configured)'}</option>
        <option value="handoff">Free: open Google results yourself</option>
        {capabilities?.providers?.serpapi && <option value="api">Automatic results inside Strikeout</option>}
      </select></label>
      <p>{automatic ? 'The selected identifier/query or image URL is sent to SerpApi for Google search. If unavailable, use the disclosed Google handoff.' : 'Strikeout prepares a link. Only when you open it will the query or image URL be shared with Google; results stay on Google.'}</p>
      <label className="check"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />This is my information or authorized content, and I approve the described provider disclosure.</label>
      <button disabled={!approved || busy || !capabilities}>{busy ? 'Preparing search…' : automatic ? 'Run selected search' : 'Prepare Google search'}</button>
    </fieldset></form>
    {error && <p role="alert" className="error">{error}</p>}
    {result && <div aria-live="polite">
      <h3>{result.status === 'requires_user_search' ? 'Ready to open on Google — search not yet completed' : result.status === 'incomplete' ? 'Some automatic checks failed' : 'Automatic check completed'}</h3>
      <p>{result.coverage}</p>
      <RiskSummary summary={result.riskSummary} />
      {(result.handoffs || (result.handoff ? [result.handoff] : [])).map((x: any, i: number) => <article className="mini-note" key={i}>
        {x.query && <p><code>{x.query}</code></p>}
        <a href={x.url} target="_blank" rel="noopener noreferrer">{result.service === 'reverse_image' ? 'Open Google Lens results ↗' : 'Open this Google search ↗'}</a>
        <p>{x.disclosure || 'Google receives this query when you open the link. Results are not automatically imported.'}</p>
      </article>)}
      {(result.findings || []).map((x: any, i: number) => <article className="step-card" key={i}><strong>{x.title}</strong><p>{x.snippet}</p><ResultLink url={x.url} assessment={x.linkAssessment} exposure={x.exposureAssessment} /><p><small>{x.confidence.replaceAll('_', ' ')}</small></p></article>)}
      {result.status === 'completed' && !result.findings?.length && <p>No matches returned within this provider response. This does not establish absence of exposure.</p>}
      {(result.limitations || []).map((x: string, i: number) => <p key={i}><small>{x}</small></p>)}
      <button onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'strikeout-search.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Download search report</button>
    </div>}
  </section>;
}
