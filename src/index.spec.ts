import * as assert from 'assert';
import { serveTests } from './server/serve';
import { helloTests } from './client/HelloComponent';

test('hello', () => {
  assert.strictEqual(1 + 2 * 3, 7);
});

describe('helloTests', helloTests);
describe('serveTests', serveTests);
