import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

const report = (as = USERS.ac) =>
  ctx.api('GET', '/teachers/report?termId=10', { as });

describe('faculty due by rank (#72)', () => {
  test('seeded Fall 2026 counts match the hand calculation', async () => {
    // No seeded completed observations:
    // Assistant: C/E/H; Associate: A/D/G/J; Full: B/F/I.
    const res = await report();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.counts.dueByRank, {
      assistant_professor: 3,
      associate_professor: 4,
      full_professor: 3,
    });
    assert.equal(res.body.counts.due, 10);
    assert.equal(res.body.counts.overdue, 0);
    assert.deepEqual(res.body.counts.overdueByRank, {
      assistant_professor: 0,
      associate_professor: 0,
      full_professor: 0,
    });
    assert.equal(res.body.counts.neverObserved, 10);
  });

  test('the report retains AC/admin access restrictions', async () => {
    assert.equal(
      (await ctx.api('GET', '/teachers/report?termId=10')).status,
      401,
    );
    assert.equal((await report(USERS.faculty)).status, 403);
    assert.equal((await report(USERS.admin)).status, 200);
  });

  test('inactive professors are excluded and empty ranks remain zero', async () => {
    const ids = [2, 6, 9]; // All three seeded full professors.
    try {
      await ctx.sql(
        'UPDATE teachers SET is_active = FALSE WHERE id = ANY($1::int[])',
        [ids],
      );
      const res = await report(USERS.admin);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.counts.dueByRank, {
        assistant_professor: 3,
        associate_professor: 4,
        full_professor: 0,
      });
      assert.equal(res.body.counts.due, 7);
    } finally {
      await ctx.sql(
        'UPDATE teachers SET is_active = TRUE WHERE id = ANY($1::int[])',
        [ids],
      );
    }
  });

  test('due and never-observed count; overdue and not-due do not', async () => {
    const created = [];
    try {
      // Fall 2026 expectations:
      // A (associate), observed Fall 2023 -> overdue.
      // C (assistant), observed Spring 2026 -> not due until 2027.
      // D (associate), observed Fall 2024 -> due Fall 2026.
      const histories = [
        { teacherId: 1, termId: 1, date: '2023-10-02' },
        { teacherId: 3, termId: 8, date: '2026-02-02' },
        { teacherId: 4, termId: 4, date: '2024-10-01' },
      ];

      for (const h of histories) {
        const [section] = await ctx.sql(
          `INSERT INTO course_sections
             (course_id, term_id, section_number, teacher_id)
           VALUES (1, $1, $2, $3) RETURNING id`,
          [h.termId, `KPI${h.teacherId}`, h.teacherId],
        );
        const entry = { sectionId: section.id };
        created.push(entry);

        const [assessment] = await ctx.sql(
          `INSERT INTO assessments
             (teacher_id, section_id, due_term_id, status)
           VALUES ($1, $2, $3, 'completed') RETURNING id`,
          [h.teacherId, section.id, h.termId],
        );
        entry.assessmentId = assessment.id;

        await ctx.sql(
          `INSERT INTO observations
             (assessment_id, observee_id, observer_id, attempt_no,
              status, scheduled_date,
              observer_signed_off_at, observee_signed_off_at)
           VALUES ($1, $2, 2, 1, 'completed', $3, now(), now())`,
          [assessment.id, h.teacherId, h.date],
        );
      }

      const res = await report();
      assert.equal(res.status, 200);

      const statusOf = (id) =>
        res.body.data.find((row) => row.id === id).dueStatus;
      assert.equal(statusOf(1), 'overdue');
      assert.equal(statusOf(3), 'not_due');
      assert.equal(statusOf(4), 'due');

      assert.deepEqual(res.body.counts.dueByRank, {
        assistant_professor: 2, // E/H
        associate_professor: 3, // D/G/J
        full_professor: 3,      // B/F/I
      });
      assert.equal(res.body.counts.due, 8);
      assert.equal(res.body.counts.overdue, 1);
      assert.deepEqual(res.body.counts.overdueByRank, {
        assistant_professor: 0,
        associate_professor: 1, // Professor A
        full_professor: 0,
      });
      console.log(
        'Overdue breakdown:',
        JSON.stringify(res.body.counts.overdueByRank),
      );

      try {
        await ctx.sql('UPDATE teachers SET is_active = FALSE WHERE id = 1');
        const inactive = await report();
        assert.equal(inactive.status, 200);
        assert.deepEqual(inactive.body.counts.overdueByRank, {
          assistant_professor: 0,
          associate_professor: 0,
          full_professor: 0,
        });
        assert.equal(inactive.body.counts.overdue, 0);
        console.log('Inactive overdue professor excluded from breakdown');
      } finally {
        await ctx.sql('UPDATE teachers SET is_active = TRUE WHERE id = 1');
      }
    } finally {
      for (const entry of created.reverse()) {
        if (entry.assessmentId) {
          await ctx.sql(
            'DELETE FROM assessments WHERE id = $1',
            [entry.assessmentId],
          );
        }
        await ctx.sql(
          'DELETE FROM course_sections WHERE id = $1',
          [entry.sectionId],
        );
      }
    }
  });
});
