import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;

before(async () => {
  ctx = await startIntegration();
});

after(async () => {
  await ctx?.close();
});

const surveyBody = {
  rating: 5,
  feedback: 'The observation process was helpful.',
  suggestions: 'Make scheduling easier.',
};

// Set survey dates around the current database date.
async function setSurveyDates(startOffset, endOffset) {
  await ctx.sql(
    `UPDATE terms
     SET observation_deadline = CURRENT_DATE + $1::int,
         feedback_deadline = CURRENT_DATE + $2::int
     WHERE id = 10`,
    [startOffset, endOffset],
  );
}

test('survey requires login and faculty profile', async () => {
  assert.equal(
    (await ctx.api('GET', '/surveys/status')).status,
    401,
  );

  assert.equal(
    (await ctx.api('POST', '/surveys', {
      as: USERS.ac,
      body: surveyBody,
    })).status,
    403,
  );

  assert.equal(
    (await ctx.api('POST', '/surveys', {
      as: USERS.admin,
      body: surveyBody,
    })).status,
    403,
  );
});

test('survey is available before observation deadline', async () => {
  await setSurveyDates(1, 7);

  const status = await ctx.api('GET', '/surveys/status', {
    as: USERS.faculty,
  });

  assert.equal(status.status, 200);
  assert.equal(status.body.available, true);

  const submit = await ctx.api('POST', '/surveys', {
    as: USERS.profA,
    body: surveyBody,
  });

  assert.equal(submit.status, 201);
});

test('survey rejects submissions after feedback deadline', async () => {
  await setSurveyDates(-7, -1);

  const status = await ctx.api('GET', '/surveys/status', {
    as: USERS.faculty,
  });

  assert.equal(status.status, 200);
  assert.equal(status.body.available, false);

  const submit = await ctx.api('POST', '/surveys', {
    as: USERS.faculty,
    body: surveyBody,
  });

  assert.equal(submit.status, 409);
});

test('survey rejects invalid ratings', async () => {
  await setSurveyDates(-1, 7);

  for (const rating of [0, 6, 'abc']) {
    const res = await ctx.api('POST', '/surveys', {
      as: USERS.faculty,
      body: { ...surveyBody, rating },
    });

    assert.equal(res.status, 400);
  }
});

test('faculty can submit once per term', async () => {
  await setSurveyDates(-1, 7);

  const initial = await ctx.api('GET', '/surveys/status', {
    as: USERS.faculty,
  });

  assert.equal(initial.status, 200);
  assert.equal(initial.body.submitted, false);
  assert.equal(initial.body.available, true);

  const submit = await ctx.api('POST', '/surveys', {
    as: USERS.faculty,
    body: surveyBody,
  });

  assert.equal(submit.status, 201);
  assert.equal(submit.body.rating, 5);

  const saved = await ctx.sql(
    `SELECT *
     FROM process_feedback
     WHERE respondent_id = 3
       AND observation_id IS NULL`,
  );

  assert.equal(saved.length, 1);
  assert.equal(saved[0].feedback, surveyBody.feedback);
  assert.equal(saved[0].suggestions, surveyBody.suggestions);

  const status = await ctx.api('GET', '/surveys/status', {
    as: USERS.faculty,
  });

  assert.equal(status.status, 200);
  assert.equal(status.body.submitted, true);

  const duplicate = await ctx.api('POST', '/surveys', {
    as: USERS.faculty,
    body: surveyBody,
  });

  assert.equal(duplicate.status, 409);
});

test('only AC and admin can view survey results', async () => {
  const faculty = await ctx.api('GET', '/surveys?termId=10', {
    as: USERS.faculty,
  });
  assert.equal(faculty.status, 403);

  for (const user of [USERS.ac, USERS.admin]) {
    const res = await ctx.api('GET', '/surveys?termId=10', {
      as: user,
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  }
});
