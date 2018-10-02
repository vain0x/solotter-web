import * as assert from 'assert';
import { serveTests } from './server/serve';
import { helloTests } from './client/HelloComponent';

test('hello', () => {
  assert.strictEqual(1 + 2 * 3, 7);
});

describe('helloTests', helloTests);
describe('serveTests', serveTests);

describe('JavaScript', () => {
  describe('String', () => {
    const r = new RegExp('^Bearer ([a-fA-F0-9]+)$');
    test('it should match', () => {
      const match = 'Bearer deadbeaf'.match(r);
      assert.strictEqual(match && match[1], 'deadbeaf');
    });

    test('it should not match', () => {
      const second = 'Basic YWxhZGRpbjpvcGVuc2VzYW1l'.match(r);
      assert.strictEqual(second && second[1], null);
    });
  });
});
