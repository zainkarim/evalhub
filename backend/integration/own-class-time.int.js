// #136: the observed class at its real meeting time is not a conflict for the
// observee. Other tests propose 06:00 to stay clear of every seeded class, so
// none of them uses a real class time.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

const DAY_CODES = { U: 0, M: 1, T: 2, W: 3, R: 4, F: 5, S: 6 };
const hhmm = (time) => String(time).slice(0, 5);

// The next date (a week or more out) on which the section meets.
function nextMeetingDate(meetingDays) {
  const days = [...meetingDays].map((code) => DAY_CODES[code]);
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  while (!days.includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// Runs fn with the section's term open around today, then restores the term.
async function withOpenTerm(sectionId, fn) {
  const [term] = await ctx.sql(
    `SELECT tm.* FROM terms tm JOIN course_sections cs ON cs.term_id = tm.id WHERE cs.id = $1`,
    [sectionId],
  );
  await ctx.sql(
    `UPDATE terms SET start_date = CURRENT_DATE - 30, end_date = CURRENT_DATE + 60,
            observation_deadline = CURRENT_DATE + 50
      WHERE id = $1`,
    [term.id],
  );
  try {
    await fn(term.id);
  } finally {
    await ctx.sql(
      'UPDATE terms SET start_date = $2, end_date = $3, observation_deadline = $4 WHERE id = $1',
      [term.id, term.start_date, term.end_date, term.observation_deadline],
    );
  }
}

test('the observee can propose, and the observer confirm, the observed class at its real time', async () => {
  // Professor C's seeded sign-up and its section's real meeting time.
  const [signUp] = await ctx.sql(
    `SELECT a.id, a.section_id, cs.meeting_days, cs.start_time, cs.end_time
       FROM assessments a JOIN course_sections cs ON cs.id = a.section_id
      WHERE a.teacher_id = 3 AND a.status = 'signed_up' AND cs.start_time IS NOT NULL
      ORDER BY a.id LIMIT 1`,
  );
  assert.ok(signUp, 'seed has a waiting sign-up for Professor C with a class time');

  await withOpenTerm(signUp.section_id, async () => {
    const date = nextMeetingDate(signUp.meeting_days);
    const slot = { proposedDate: date, startTime: hhmm(signUp.start_time), endTime: hhmm(signUp.end_time) };

    const proposed = await ctx.api('POST', `/assessments/${signUp.id}/time-options`, {
      as: USERS.faculty,
      body: { options: [slot] },
    });
    assert.equal(proposed.status, 201, JSON.stringify(proposed.body));
    const optionId = proposed.body.data[0].id;

    // An observer with no class of their own at that time.
    const [observer] = await ctx.sql(
      `SELECT t.id, t.email FROM teachers t
        WHERE t.id <> 3 AND t.is_active
          AND NOT EXISTS (
            SELECT 1 FROM course_sections cs
             WHERE cs.teacher_id = t.id AND cs.start_time IS NOT NULL
               AND strpos(cs.meeting_days, $1) > 0
               AND cs.start_time < $3::time AND cs.end_time > $2::time)
        ORDER BY t.id LIMIT 1`,
      [Object.keys(DAY_CODES).find((code) => DAY_CODES[code] === new Date(`${date}T00:00:00Z`).getUTCDay()),
        slot.startTime, slot.endTime],
    );
    await ctx.sql(
      `INSERT INTO time_option_offers (option_id, teacher_id, status) VALUES ($1, $2, 'pending')`,
      [optionId, observer.id],
    );

    const confirmed = await ctx.api('POST', `/time-options/${optionId}/confirm`, { as: observer.email });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    const [option] = await ctx.sql('SELECT is_confirmed FROM assessment_time_options WHERE id = $1', [optionId]);
    assert.equal(option.is_confirmed, true);
  });
});

test("the observee's other classes at that time still conflict", async () => {
  const [signUp] = await ctx.sql(
    `SELECT a.id, a.section_id, cs.course_id, cs.term_id, cs.meeting_days, cs.start_time, cs.end_time
       FROM assessments a JOIN course_sections cs ON cs.id = a.section_id
      WHERE a.teacher_id = 3 AND cs.start_time IS NOT NULL
      ORDER BY a.id LIMIT 1`,
  );

  await withOpenTerm(signUp.section_id, async () => {
    // A second section Professor C teaches at the same days and time.
    await ctx.sql(
      `INSERT INTO course_sections (course_id, term_id, section_number, teacher_id, meeting_days, start_time, end_time)
       VALUES ($1, $2, 'X99', 3, $3, $4, $5)`,
      [signUp.course_id, signUp.term_id, signUp.meeting_days, signUp.start_time, signUp.end_time],
    );
    try {
      const date = nextMeetingDate(signUp.meeting_days);
      const res = await ctx.api('POST', `/assessments/${signUp.id}/time-options`, {
        as: USERS.faculty,
        body: { options: [{ proposedDate: date, startTime: hhmm(signUp.start_time), endTime: hhmm(signUp.end_time) }] },
      });
      assert.equal(res.status, 409, JSON.stringify(res.body));
      assert.match(res.body.error.message, /X99/);
    } finally {
      await ctx.sql(`DELETE FROM course_sections WHERE section_number = 'X99' AND teacher_id = 3`);
    }
  });
});
