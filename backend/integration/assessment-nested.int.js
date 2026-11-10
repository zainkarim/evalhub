import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

const assertNested = (a) => {
  // The redesigned frontend reads these (api-expectations.md, AssessmentView).
  assert.equal(a.teacher.id, a.teacherId);
  assert.ok(a.teacher.firstName && a.teacher.lastName && a.teacher.rank && a.teacher.school);
  assert.equal(a.section.id, a.sectionId);
  assert.ok(a.section.sectionNumber);
  assert.ok(a.section.course.subject && a.section.course.courseNumber && a.section.course.title);
  assert.equal(a.section.term.id, a.dueTermId);
  assert.ok(a.section.term.season && a.section.term.year);
};

test('GET /assessments/:id carries nested teacher and section, and keeps the flat fields', async () => {
  const list = await ctx.api('GET', '/assessments?teacherId=3', { as: USERS.ac });
  const { id } = list.body.data[0];

  const res = await ctx.api('GET', `/assessments/${id}`, { as: USERS.ac });
  assert.equal(res.status, 200);
  assertNested(res.body);
  assert.ok(res.body.courseCode, 'flat courseCode is still there');
  assert.ok(res.body.sectionCode, 'flat sectionCode is still there');
  assert.equal(res.body.section.course.subject + res.body.section.course.courseNumber, res.body.courseCode);
});

test('the AC list and the faculty "mine" list carry the nested view too', async () => {
  const list = await ctx.api('GET', '/assessments?teacherId=3', { as: USERS.ac });
  assert.equal(list.status, 200);
  list.body.data.forEach(assertNested);

  const mine = await ctx.api('GET', '/assessments/mine', { as: USERS.faculty });
  assert.equal(mine.status, 200);
  assert.ok(mine.body.data.length > 0);
  mine.body.data.forEach(assertNested);
});

test('GET /assessments/:id carries the rest of AssessmentDetail so the page can render', async () => {
  const list = await ctx.api('GET', '/assessments?teacherId=3', { as: USERS.ac });
  const { id } = list.body.data[0];

  const res = await ctx.api('GET', `/assessments/${id}`, { as: USERS.ac });
  assert.equal(res.status, 200);
  for (const key of ['candidates', 'timeOptions', 'offers', 'observations', 'attempts', 'observerList']) {
    assert.ok(Array.isArray(res.body[key]), `${key} is an array`);
  }
  assert.ok(res.body.attemptNo >= 1);
  assert.ok('candidateList' in res.body && 'pairing' in res.body && 'alert' in res.body);
});
