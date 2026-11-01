import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(await readFile('extension/link-domains.js', 'utf8'), context);
const { match, brands, targets } = context.PopLookalikes;
test('mail, social and payment typos resolve to the exact intended warning suggestion', () => {
  for(const [typo, real] of Object.entries({
    'gmaail.com':'gmail.com', 'gmmail.com':'gmail.com',
    'gmial.com':'gmail.com', 'gmai1.com':'gmail.com',
    'instaagram.com':'instagram.com', 'outllook.com':'outlook.com',
    'yahhoo.com':'yahoo.com', 'paypa1.com':'paypal.com',
    'githhub.com':'github.com', 'teleggram.org':'telegram.org',
    'prooton.me':'proton.me', 'twiitch.tv':'twitch.tv',
  })) {
    assert.equal(match(typo), real, typo);
    assert.equal(match('login.' + typo), real, 'subdomain of ' + typo);
    assert.equal(match(typo.toUpperCase() + '.'), real);
  }
});
test('correct official names and unrelated sites are not blocked by substring resemblance', () => {
  for(const real of brands) {
    assert.equal(match(real),null,real);
    assert.equal(match('accounts.' + real),null,real);
  }
  for(const host of ['example.org','notgmail.com','gmaail.com.example.org','mail.google.com'])
    assert.equal(match(host),null,host);
  assert.ok(targets.size > 300);
});
