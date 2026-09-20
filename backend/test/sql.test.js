import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildUpdate, escapeLike, pageOffset } from '../src/db/sql.js';

const COLUMNS = { firstName: 'first_name', lastName: 'last_name', isActive: 'is_active' };

describe('buildUpdate', () => {
  test('only includes fields present in the body, mapped to whitelisted columns', () => {
    const { sets, values } = buildUpdate({ firstName: 'Ada', isActive: false }, COLUMNS);
    assert.deepEqual(sets, ['first_name = $1', 'is_active = $2']);
    assert.deepEqual(values, ['Ada', false]);
  });

  test('null is a real value (clears a column); undefined is skipped', () => {
    const { sets, values } = buildUpdate({ firstName: null, lastName: undefined }, COLUMNS);
    assert.deepEqual(sets, ['first_name = $1']);
    assert.deepEqual(values, [null]);
  });

  test('ignores keys that are not in the whitelist (no SQL injection via field names)', () => {
    const { sets, values } = buildUpdate({ 'first_name = 1; DROP TABLE teachers; --': 'x', lastName: 'Liu' }, COLUMNS);
    assert.deepEqual(sets, ['last_name = $1']);
    assert.deepEqual(values, ['Liu']);
  });

  test('honours a starting placeholder index', () => {
    const { sets } = buildUpdate({ firstName: 'A', lastName: 'B' }, COLUMNS, 3);
    assert.deepEqual(sets, ['first_name = $3', 'last_name = $4']);
  });

  test('returns nothing to update for an empty body', () => {
    assert.deepEqual(buildUpdate({}, COLUMNS), { sets: [], values: [] });
  });
});

describe('escapeLike', () => {
  test('escapes LIKE wildcards and the escape character', () => {
    assert.equal(escapeLike('50%_off\\'), '50\\%\\_off\\\\');
  });
  test('leaves ordinary text alone', () => {
    assert.equal(escapeLike('Okafor'), 'Okafor');
  });
});

describe('pageOffset', () => {
  test('computes zero-based row offsets', () => {
    assert.equal(pageOffset(1, 25), 0);
    assert.equal(pageOffset(3, 25), 50);
  });
});
