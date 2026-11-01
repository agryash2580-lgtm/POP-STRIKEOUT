import test from 'node:test';
import assert from 'node:assert/strict';
import { prioritizeFindings } from '../api/osint/prioritize.mjs';
import { runCheck } from '../api/osint/osint.mjs';
import { reviewDocuments } from '../api/osint/documents.mjs';

test('urgency precedes evidence; ties preserve input order without mutation or lost results', () => {
  const rows = [
    {id:'lead',reviewPriority:'review',confidence:'unverified_search_lead'},
    {id:'exact',reviewPriority:'review',confidence:'exact_occurrence_in_public_provider_text'},
    {id:'pattern',category:'credential_like_assignment',reviewPriority:'high',confidence:'pattern_match_not_validated'},
    {id:'record',category:'payment_card_exposure',reviewPriority:'high',confidence:'provider_record'},
    {id:'tie',reviewPriority:'review',confidence:'exact_occurrence_in_supplied_text'},
    {id:'unknown',confidence:'unknown'},
  ];
  const before = structuredClone(rows);
  const ranked = prioritizeFindings(rows);
  assert.deepEqual(ranked.map(x=>x.id), ['pattern','record','exact','tie','lead','unknown']);
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


test('severity policy distinguishes credentials, identity/payment, contact, and profile references', () => {
  const findings = prioritizeFindings([
    {category:'public_linkedin_reference'},
    {category:'email_occurrence'},
    {category:'possible_identity_document'},
    {category:'credential_like_assignment'},
    {category:'payment_card_exposure'},
    {category:'public_phone_reference'},
  ]);
  assert.deepEqual(findings.map(f=>f.severity), ['critical','high','high','medium','medium','low']);
  assert.ok(findings.every(f=>f.severityReason));
});

test('breach severity uses returned data classes, not provider confidence alone', () => {
  const findings = prioritizeFindings([
    {id:'email',category:'breach_membership',dataClasses:['Email addresses'],confidence:'provider_record'},
    {id:'missing',category:'breach_membership'},
    {id:'financial',category:'breach_membership',dataClasses:['Bank account numbers']},
    {id:'credential',category:'breach_membership',dataClasses:['Passwords']},
  ]);
  assert.deepEqual(findings.map(f=>[f.id,f.severity]), [['credential','critical'],['financial','high'],['email','medium'],['missing','medium']]);
});

test('generic web leads use checked service and unknown findings stay provisional', () => {
  assert.equal(prioritizeFindings([{category:'public_reference'}],{service:'phone'})[0].severity,'medium');
  assert.equal(prioritizeFindings([{category:'public_reference'}],{service:'instagram'})[0].severity,'low');
  assert.match(prioritizeFindings([{category:'unknown'}])[0].severityReason,/provisional/);
});
