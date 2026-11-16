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

test('the nested term matches GET /terms field for field', async () => {
  const list = await ctx.api('GET', '/assessments?teacherId=3', { as: USERS.ac });
  const nested = list.body.data[0].section.term;
  const terms = await ctx.api('GET', '/terms', { as: USERS.ac });
  assert.deepEqual(nested, terms.body.data.find((t) => t.id === nested.id));
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

// A fresh sign-up for Professor C (teacher 3) on a new section of one of their courses.
async function makeAssessment(label) {
  const [section] = await ctx.sql(
    `INSERT INTO course_sections (course_id, term_id, section_number, teacher_id)
     SELECT course_id, term_id, $1, 3 FROM course_sections WHERE teacher_id = 3 ORDER BY id LIMIT 1
     RETURNING id, term_id`,
    [label],
  );
  const [assessment] = await ctx.sql(
    'INSERT INTO assessments (teacher_id, section_id, due_term_id) VALUES (3, $1, $2) RETURNING id',
    [section.id, section.term_id],
  );
  return assessment.id;
}

test('GET /assessments/:id returns the requests sent to observers (offers)', async () => {
  const id = await makeAssessment('N1');
  // Dates in the past (sign-off is allowed right away) at 06:00, which avoids every seeded class.
  const options = await ctx.sql(
    `INSERT INTO assessment_time_options (assessment_id, proposed_date, start_time, end_time)
     VALUES ($1, CURRENT_DATE - 90, '06:00', '06:30'), ($1, CURRENT_DATE - 91, '06:00', '06:30')
     RETURNING id`,
    [id],
  );
  // Observer 1 gets both dates; observer 4 gets the first one and declines it.
  await ctx.sql(
    `INSERT INTO time_option_offers (option_id, teacher_id, status)
     VALUES ($1, 1, 'pending'), ($2, 1, 'pending'), ($1, 4, 'pending')`,
    [options[0].id, options[1].id],
  );
  const declined = await ctx.api('POST', `/assessments/${id}/time-options/decline`, {
    as: USERS.profD,
    body: { reason: 'Teaching conflict' },
  });
  assert.equal(declined.status, 200, JSON.stringify(declined.body));

  const res = await ctx.api('GET', `/assessments/${id}`, { as: USERS.faculty });
  assert.equal(res.status, 200);
  const byObserver = Object.fromEntries(res.body.offers.map((o) => [o.observerId, o]));

  assert.equal(res.body.offers.length, 2, 'one offer per observer');
  assert.equal(byObserver[1].status, 'pending');
  assert.equal(byObserver[1].options.length, 2);
  assert.ok(byObserver[1].observer.firstName, 'the observer is named');
  assert.ok(byObserver[1].sentAt);
  assert.equal(byObserver[4].status, 'declined');
  assert.equal(byObserver[4].reason, 'Teaching conflict');
  assert.ok(byObserver[4].respondedAt);
  assert.equal(res.body.offer.observerId, 1, 'offer is the request still waiting');

  // Each date also lists its offer rows, like GET /assessments/:id/time-options.
  const first = res.body.timeOptions.find((o) => o.id === options[0].id);
  assert.deepEqual(first.offers.map((o) => o.teacherId).sort(), [1, 4]);

  // Observer 1 confirms a date: their offer reads confirmed and nothing is waiting.
  const confirmed = await ctx.api('POST', `/time-options/${options[1].id}/confirm`, { as: USERS.profA });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  const after = await ctx.api('GET', `/assessments/${id}`, { as: USERS.faculty });
  const afterBy = Object.fromEntries(after.body.offers.map((o) => [o.observerId, o]));
  assert.equal(afterBy[1].status, 'confirmed');
  assert.equal(afterBy[4].status, 'declined', 'a decline stays a decline');
  assert.equal(after.body.offer, null);
});
