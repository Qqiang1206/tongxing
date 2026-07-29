import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBeforeCommit,
  applyStrings,
  collectStrings,
  mergeTranslatedValues,
  normalizeForCompare,
  planTranslations,
  snapshotEntries,
} from '../src/services/translationFields.js';

function collect(source, itemId = '') {
  const paths = [];
  const values = [];
  collectStrings(source, '', paths, values, itemId);
  return { paths, values };
}

function makeSnapshot(source, itemId = '') {
  const { paths, values } = collect(source, itemId);
  return Object.fromEntries(
    snapshotEntries('fixture', 'en', itemId, paths, values).map((entry) => [entry[3], entry[4]])
  );
}

function buildOutput(source, existing, snapshot, translated, itemId = '') {
  const { paths, values } = collect(source, itemId);
  const plan = planTranslations({ paths, values, existingObj: existing, snapshot, itemId });
  const merged = mergeTranslatedValues(plan, translated);
  const output = structuredClone(source);
  let index = 0;
  applyStrings(output, '', () => merged[index++]);
  return { output, plan };
}

test('single field edit preserves every unrelated translated field', () => {
  const before = {
    hero: { title: 'old-title', lead: 'keep-source' },
    sections: [{ title: 'section-a', body: 'body-a' }, { title: 'section-b', body: 'body-b' }],
  };
  const existing = {
    hero: { title: 'Old title', lead: 'Keep unchanged' },
    sections: [{ title: 'Section one', body: 'Body one' }, { title: 'Section two', body: 'Body two' }],
  };
  const after = structuredClone(before);
  after.hero.title = 'new-title';

  const { output, plan } = buildOutput(after, existing, makeSnapshot(before), ['New title']);
  assert.deepEqual(plan.changedValues, ['new-title']);
  assert.equal(output.hero.title, 'New title');
  assert.equal(output.hero.lead, existing.hero.lead);
  assert.deepEqual(output.sections, existing.sections);
});

test('punctuation changes are treated as real source changes', () => {
  assert.notEqual(normalizeForCompare('Efficiency first.'), normalizeForCompare('Efficiency first!'));
  assert.equal(normalizeForCompare('  TXAM  Factory\r\n'), normalizeForCompare('TXAM Factory\n'));

  const before = { title: 'efficiency-first.' };
  const after = { title: 'efficiency-first!' };
  const existing = { title: 'Efficiency first.' };
  const { plan } = buildOutput(after, existing, makeSnapshot(before), ['Efficiency first!']);
  assert.deepEqual(plan.changedValues, ['efficiency-first!']);
});


test('intentional empty target fields remain empty when another field changes', () => {
  const before = { title: 'old-title', unit: 'source-unit' };
  const after = { title: 'new-title', unit: 'source-unit' };
  const existing = { title: 'Old title', unit: '' };
  const { output, plan } = buildOutput(after, existing, makeSnapshot(before), ['New title']);

  assert.deepEqual(plan.changedValues, ['new-title']);
  assert.equal(output.title, 'New title');
  assert.equal(output.unit, '');
});
test('reordering array rows reuses the matching old translations', () => {
  const before = {
    rows: [
      { title: 'row-a', body: 'body-a' },
      { title: 'row-b', body: 'body-b' },
    ],
  };
  const existing = {
    rows: [
      { title: 'Alpha', body: 'Alpha body' },
      { title: 'Beta', body: 'Beta body' },
    ],
  };
  const after = { rows: [before.rows[1], before.rows[0]] };
  const { output, plan } = buildOutput(after, existing, makeSnapshot(before), []);

  assert.equal(plan.changedValues.length, 0);
  assert.deepEqual(output.rows, [existing.rows[1], existing.rows[0]]);
});

test('inserting an array row translates only the new row', () => {
  const before = {
    rows: [
      { title: 'row-a', body: 'body-a' },
      { title: 'row-b', body: 'body-b' },
    ],
  };
  const existing = {
    rows: [
      { title: 'Alpha', body: 'Alpha body' },
      { title: 'Beta', body: 'Beta body' },
    ],
  };
  const after = {
    rows: [before.rows[0], { title: 'row-new', body: 'body-new' }, before.rows[1]],
  };
  const { output, plan } = buildOutput(
    after,
    existing,
    makeSnapshot(before),
    ['Added', 'Added body']
  );

  assert.deepEqual(plan.changedValues, ['row-new', 'body-new']);
  assert.deepEqual(output.rows, [
    existing.rows[0],
    { title: 'Added', body: 'Added body' },
    existing.rows[1],
  ]);
});

test('deleting an array row does not retranslate rows that shift indexes', () => {
  const before = {
    rows: [
      { title: 'row-a', body: 'body-a' },
      { title: 'row-b', body: 'body-b' },
    ],
  };
  const existing = {
    rows: [
      { title: 'Alpha', body: 'Alpha body' },
      { title: 'Beta', body: 'Beta body' },
    ],
  };
  const after = { rows: [before.rows[1]] };
  const { output, plan } = buildOutput(after, existing, makeSnapshot(before), []);

  assert.equal(plan.changedValues.length, 0);
  assert.deepEqual(output.rows, [existing.rows[1]]);
});

test('a target build failure prevents every write callback', async () => {
  let commits = 0;
  await assert.rejects(
    buildBeforeCommit(
      [
        async () => ({ lang: 'en' }),
        async () => { throw new Error('provider_failed'); },
      ],
      async () => { commits++; }
    ),
    /provider_failed/
  );
  assert.equal(commits, 0);
});
