import test from 'node:test';
import assert from 'node:assert/strict';
import { prioritizeFindings } from '../api/osint/prioritize.mjs';
import { runCheck } from '../api/osint/osint.mjs';
import { reviewDocuments } from '../api/osint/documents.mjs';

test('urgency precedes evidence; ties preserve input order without mutation or lost results', () => {
  const rows = [
    {id:'lead',reviewPriority:'review',confidence:'unverified_search_lead'},
    {id:'exact',reviewPriority:'review',confidence:'exact_occurrence_in_public_provider_text'},
    {id:'pattern',reviewPriority:'high',confidence:'pattern_match_not_validated'},
    {id:'record',reviewPriority:'high',confidence:'provider_record'},
    {id:'tie',reviewPriority:'review',confidence:'exact_occurrence_in_supplied_text'},
    {id:'unknown',confidence:'unknown'},
  ];
  const before = structuredClone(rows);
  const ranked = prioritizeFindings(rows);
  assert.deepEqual(ranked.map(x=>x.id), ['record','pattern','exact','tie','lead','unknown']);
  assert.deepEqual(rows,before);
  assert.ok(ranked.every(x=>x.priorityReason));
  assert.deepEqual(prioritizeFindings([]),[]);
});

test('live check path ranks exact evidence before search leads and keeps strongest duplicate', async () => {
  const url = 'https://github.com/example/project/issues/1';
  const report = await runCheck({service:'email',input:{email:'demo@example.org'},consent:{selfOwned:true,version:'1',providers:['github_public','brave','hibp']}},{
    env:{BRAVE_SEARCH_API_KEY:'test',HIBP_API_KEY:'test'},
    fetcher: async endpoint => {
      const host = new URL(endpoint).hostname;
      if(host === 'haveibeenpwned.com') return Response.json([{Name:'ExampleBreach',DataClasses:['Email addresses']}]);
      if(host === 'api.github.com') return Response.json({incomplete_results:false,items:[{html_url:url,body:'demo@example.org'}]});
      assert.equal(host,'api.search.brave.com');
      return Response.json({web:{results:[{url:'https://example.org/lead',title:'Unverified lead'},{url,title:'Duplicate'}]}});
    },
  });
  assert.deepEqual(report.findings.map(x=>x.confidence),['provider_record','exact_occurrence_in_public_provider_text','unverified_search_lead']);
  assert.equal(report.status,'completed');
  assert.equal(report.coverage.length,3);
});

test('supplied document path puts sensitive patterns ahead of ordinary identifiers and retains masking', () => {
  const report = reviewDocuments({identifiers:{emails:['demo@example.org']},documents:[{text:'demo@example.org password=FictionalSecret123'}],consent:{selfOwned:true,version:'1'}});
  assert.deepEqual(report.findings.map(x=>x.category),['credential_like_assignment','email_occurrence']);
  assert.match(report.findings[0].priorityReason,/Unverified/);
  assert.ok(!JSON.stringify(report).includes('FictionalSecret123'));
});
