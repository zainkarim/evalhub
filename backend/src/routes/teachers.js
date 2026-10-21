import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { buildUpdate, escapeLike, pageOffset } from '../db/sql.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { idParams, pagination, paged, validate } from '../middleware/validate.js';

const router = Router();

// Keep in sync with the CHECK constraint on teachers.rank in 001_initial_schema.sql.
const RANKS = ['assistant_professor', 'associate_professor', 'full_professor'];

// Requirements §4.2: an observer may take on at most this many observations per
// cycle (postponed attempts don't count against the cap). Mirrors the frontend's
// APP_SETTINGS.observerCap (frontend/src/lib/mockData.js). There's no app_settings
// row for it because nothing before this endpoint needed it configurable --
// hardcoded here for the same reason the frontend hardcodes it.
const OBSERVER_CAP = 3;

const toTeacher = (r) => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  school: r.school,
  department: r.department,
  rank: r.rank,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const teacherFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  // Short upper-case school code, e.g. ECS, EPPS (normalised so equality matching works)
  school: z.string().trim().toUpperCase().min(1).max(50),
  // Observer matching is by department (migration 005), e.g. CS. Defaults to
  // the school on create, the same fallback migration 005 used.
  department: z.string().trim().toUpperCase().min(1).max(50).optional(),
  rank: z.enum(RANKS),
  isActive: z.boolean().optional(),
};
const createBody = z.object(teacherFields);
const updateBody = z.object(teacherFields).partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' });

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  school: z.string().trim().toUpperCase().max(50).optional(),
  rank: z.enum(RANKS).optional(),
  active: z.enum(['true', 'false']).optional(),
  ...pagination,
  // The AC Professors page loads the whole roster at once; the department
  // alone has 130+ teachers after the Nebula import, past the usual 100.
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
});

const COLUMNS = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  school: 'school',
  department: 'department',
  rank: 'rank',
  isActive: 'is_active',
};

// ---------------------------------------------------------------------------
// #71/#91: due/overdue report + professor profile for the AC.
//
// Ported from the real contract, not reinvented: frontend/src/lib/dueStatus.js
// (computeDue) and frontend/src/lib/mockServer.js (reportRow, GET /teachers/report,
// GET /teachers/:id/profile) on origin/onkar/sprint2-frontend are the source of
// truth per Zain's review on #91 -- the frontend was built against that mock
// first, so these endpoints match its shapes and edge cases field-for-field
// rather than inventing a parallel contract.
// ---------------------------------------------------------------------------

const rankLabel = (rank) => rank
  .split('_')
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

const courseLabel = (subject, courseNumber) => `${subject} ${courseNumber}`;

const termBrief = (t) => ({ id: t.id, season: t.season, year: t.year });

// dueStatus.js: termIndex/termFromIndex -- position in the Spring/Fall sequence.
// Summer has no slot of its own: an observation held in Summer counts as the
// Spring before it, and a Summer report term is never due/overdue at all.
const termIndex = (season, year) => year * 2 + (season === 'fall' ? 1 : 0);
const termFromIndex = (index) => ({
  season: index % 2 === 1 ? 'fall' : 'spring',
  year: Math.floor(index / 2),
});

// dueStatus.js: DEFAULT_FREQUENCY_YEARS. Assistant professors: once every
// calendar year. Associate/Full: once every 2 years.
const frequencyYearsFor = (rank) => (rank === 'assistant_professor' ? 1 : 2);

// dueStatus.js: computeDue. `lastObservedTerm` is the {season, year} of the
// last COMPLETED observation this teacher sat for as observee (the section's
// own term, which migration 002 guarantees equals assessments.due_term_id),
// or null if they have never been observed.
function computeDue(rank, lastObservedTerm, term) {
  if (!lastObservedTerm) return { status: 'never_observed', dueTerm: null, dueWindow: [] };

  const years = frequencyYearsFor(rank);
  const now = termIndex(term.season, term.year);
  let windowStart;
  let windowEnd;

  if (rank === 'assistant_professor') {
    // Calendar-year rule: the whole year `years` after the last one is the window.
    windowStart = (lastObservedTerm.year + years) * 2;
    windowEnd = windowStart + 1;
  } else {
    // Two Spring/Fall terms per year, so 2 years = 4 terms; only that one term is "due".
    windowStart = termIndex(lastObservedTerm.season, lastObservedTerm.year) + years * 2;
    windowEnd = windowStart;
  }

  const dueWindow = [];
  for (let i = windowStart; i <= windowEnd; i += 1) dueWindow.push(termFromIndex(i));

  const status = now < windowStart ? 'not_due' : now <= windowEnd ? 'due' : 'overdue';
  return { status, dueTerm: dueWindow[0], dueWindow };
}

// dueStatus.js: defaultReportTerm. The term in progress today, else the next
// upcoming Spring/Fall term, else the most recent one. Summer terms are
// excluded from the cycle entirely, so they're never picked as the default.
function defaultReportTerm(terms, today) {
  const cycle = terms
    .filter((t) => t.season !== 'summer')
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  return (
    cycle.find((t) => t.start_date <= today && today <= t.end_date)
    ?? cycle.find((t) => t.start_date > today)
    ?? cycle.at(-1)
    ?? null
  );
}

// mockServer.js: SIGNUP_PRIORITY -- the sign-up that "stands for" a teacher in
// a term when they have more than one (e.g. signed up for two sections), the
// furthest-along one wins. pending_ac_approval is legacy (migration 003
// removed AC approval from the workflow) but old rows may still carry it.
const SIGNUP_PRIORITY = {
  completed: 5,
  approved: 4,
  candidates_generated: 3,
  pending_ac_approval: 3,
  signed_up: 2,
  postponed: 1,
};

const CLOSING_OBSERVATION_STATUSES = ['postponed', 'not_completed'];

// mockServer.js: currentStatusOf. `observations` is every observation row
// that belongs to this one assessment (any order).
function currentStatusOf(assessment, observations) {
  if (!assessment) return { currentStatus: 'none', currentDate: null, attempts: 0 };

  if (assessment.status === 'completed') {
    const done = observations
      .filter((o) => o.status === 'completed')
      .map((o) => o.scheduled_date)
      .sort()
      .at(-1);
    return { currentStatus: 'completed', currentDate: done ?? null, attempts: 0 };
  }

  if (assessment.status === 'approved') {
    const active = observations.find((o) => o.status === 'approved');
    return { currentStatus: 'scheduled', currentDate: active?.scheduled_date ?? null, attempts: 0 };
  }

  // A request sent to an observer, awaiting their response. (AC review of the
  // observer choice was retired in migration 003 / the POST /review 410 --
  // "proposed" today just means the request is out, nothing is pending AC.)
  if (observations.some((o) => o.status === 'proposed')) {
    return { currentStatus: 'request_sent', currentDate: null, attempts: 0 };
  }

  if (assessment.status === 'postponed') {
    const closed = observations.filter((o) => CLOSING_OBSERVATION_STATUSES.includes(o.status)).length;
    return { currentStatus: 'postponed', currentDate: null, attempts: Math.max(closed, 1) };
  }

  return { currentStatus: 'selecting_observer', currentDate: null, attempts: 0 };
}

// Shared by both endpoints: resolve the report term from an optional termId,
// defaulting the same way the frontend mock does.
async function resolveReportTerm(termId) {
  const { rows: terms } = await query('SELECT * FROM terms');
  if (termId) {
    const term = terms.find((t) => t.id === termId);
    if (!term) throw notFound('Term');
    return term;
  }
  const today = new Date().toISOString().slice(0, 10);
  const term = defaultReportTerm(terms, today);
  if (!term) throw new HttpError(404, 'not_found', 'No term to report on');
  return term;
}

// GET /api/teachers?q=&school=&rank=&active=&page=&pageSize=   (AC / admin)
router.get('/', requireRole(...AC_OR_ADMIN), validate(listQuery, 'query'), async (req, res) => {
  const { q, school, rank, active, page, pageSize } = req.valid.query;
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replaceAll('?', `$${params.length}`)); };

  if (q) add('(first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?)', `%${escapeLike(q)}%`);
  if (school) add('school = ?', school);
  if (rank) add('rank = ?', rank);
  if (active) add('is_active = ?', active === 'true');

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ rows }, { rows: count }] = await Promise.all([
    query(
      `SELECT * FROM teachers ${clause} ORDER BY last_name, first_name, id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, pageOffset(page, pageSize)],
    ),
    query(`SELECT count(*)::int AS total FROM teachers ${clause}`, params),
  ]);
  res.json(paged(rows.map(toTeacher), count[0].total, page, pageSize));
});

const reportQuery = z.object({
  termId: z.coerce.number().int().positive().optional(),
});

// GET /api/teachers/report?termId=   (AC / admin)   -- every professor, signed
// up or not, each with isActive. Inactive ones stay in `data` so the AC can
// find and reactivate them; `counts` only covers active ones.
// Must be registered before GET /:id, or Express treats "report" as :id.
router.get(
  '/report',
  requireRole(...AC_OR_ADMIN),
  validate(reportQuery, 'query'),
  async (req, res) => {
    const term = await resolveReportTerm(req.valid.query.termId);

    const { rows: teachers } = await query('SELECT * FROM teachers ORDER BY last_name, first_name, id');

    // Every completed observation as observee, oldest first, with the term it
    // counts toward.
    const { rows: historyRows } = await query(
      `SELECT o.id AS observation_id, o.observee_id, o.scheduled_date,
              tm.id AS term_id, tm.season, tm.year, tm.start_date, tm.end_date
         FROM observations o
         JOIN assessments a ON a.id = o.assessment_id
         JOIN terms tm ON tm.id = a.due_term_id
        WHERE o.status = 'completed'
        ORDER BY o.observee_id, o.scheduled_date`,
    );
    const historyByTeacher = new Map();
    for (const h of historyRows) {
      if (!historyByTeacher.has(h.observee_id)) historyByTeacher.set(h.observee_id, []);
      historyByTeacher.get(h.observee_id).push(h);
    }

    // The sign-up that stands for each teacher in this term.
    const { rows: signUpRows } = await query(
      `SELECT a.*, cs.section_number, c.subject, c.course_number
         FROM assessments a
         JOIN course_sections cs ON cs.id = a.section_id
         JOIN courses c ON c.id = cs.course_id
        WHERE a.due_term_id = $1 AND a.status <> 'not_eligible'`,
      [term.id],
    );
    const signUpByTeacher = new Map();
    for (const row of signUpRows) {
      const current = signUpByTeacher.get(row.teacher_id);
      const priority = SIGNUP_PRIORITY[row.status] ?? 0;
      if (!current || priority > (SIGNUP_PRIORITY[current.status] ?? 0)) {
        signUpByTeacher.set(row.teacher_id, row);
      }
    }

    const assessmentIds = [...signUpByTeacher.values()].map((a) => a.id);
    const { rows: obsRows } = assessmentIds.length
      ? await query(
        'SELECT * FROM observations WHERE assessment_id = ANY($1) ORDER BY assessment_id, attempt_no',
        [assessmentIds],
      )
      : { rows: [] };
    const obsByAssessment = new Map();
    for (const o of obsRows) {
      if (!obsByAssessment.has(o.assessment_id)) obsByAssessment.set(o.assessment_id, []);
      obsByAssessment.get(o.assessment_id).push(o);
    }

    const data = teachers.map((t) => {
      const history = historyByTeacher.get(t.id) ?? [];
      // Due status looks at observations finished BEFORE the term starts, so a
      // professor observed this term still shows why they were due.
      const baseline = history.filter((h) => h.start_date < term.start_date);
      const last = baseline.at(-1);
      const lastShown = history.filter((h) => h.start_date <= term.end_date).at(-1);
      const due = computeDue(t.rank, last ? { season: last.season, year: last.year } : null, term);
      const signUp = signUpByTeacher.get(t.id) ?? null;
      const status = currentStatusOf(signUp, signUp ? obsByAssessment.get(signUp.id) ?? [] : []);

      return {
        id: t.id,
        firstName: t.first_name,
        lastName: t.last_name,
        email: t.email,
        school: t.school,
        department: t.department,
        isActive: t.is_active,
        rank: t.rank,
        rankLabel: rankLabel(t.rank),
        dueStatus: due.status,
        dueTerm: due.dueTerm,
        dueWindow: due.dueWindow,
        lastCompleted: lastShown
          ? {
            observationId: lastShown.observation_id,
            date: lastShown.scheduled_date,
            term: { id: lastShown.term_id, season: lastShown.season, year: lastShown.year },
          }
          : null,
        ...status,
        signUp: signUp
          ? {
            assessmentId: signUp.id,
            course: courseLabel(signUp.subject, signUp.course_number),
            section: signUp.section_number,
          }
          : null,
      };
    });

    const active = data.filter((r) => r.isActive);
    const count = (test) => active.filter(test).length;

    res.json({
      term: termBrief(term),
      counts: {
        // `due` includes professors never observed; `neverObserved` says how many.
        due: count((r) => r.dueStatus === 'due' || r.dueStatus === 'never_observed'),
        overdue: count((r) => r.dueStatus === 'overdue'),
        neverObserved: count((r) => r.dueStatus === 'never_observed'),
        signedUp: count((r) => r.signUp),
        notSignedUp: count((r) => !r.signUp),
        completed: count((r) => r.currentStatus === 'completed'),
      },
      data,
    });
  },
);

// GET /api/teachers/:id/profile?termId=   (AC / admin, or the teacher themself)
// -- what the committee needs to pick candidates: the report-row summary, the
// teacher's recent/current courses, their observation history on both sides,
// their current observer load, and their sign-up for the report term.
router.get(
  '/:id/profile',
  validate(idParams, 'params'),
  validate(reportQuery, 'query'),
  async (req, res) => {
    const { id } = req.valid.params;
    const isSelf = req.user.teacherId === id;
    if (!isSelf && !AC_OR_ADMIN.includes(req.user.role)) {
      throw new HttpError(403, 'forbidden', 'You do not have permission to do that');
    }

    const { rows: teacherRows } = await query('SELECT * FROM teachers WHERE id = $1', [id]);
    const teacher = teacherRows[0];
    if (!teacher) throw notFound('Teacher');

    const term = await resolveReportTerm(req.valid.query.termId);

    const { rows: historyRows } = await query(
      `SELECT o.id AS observation_id, o.scheduled_date,
              tm.id AS term_id, tm.season, tm.year, tm.start_date, tm.end_date
         FROM observations o
         JOIN assessments a ON a.id = o.assessment_id
         JOIN terms tm ON tm.id = a.due_term_id
        WHERE o.status = 'completed' AND o.observee_id = $1
        ORDER BY o.scheduled_date`,
      [id],
    );
    const baseline = historyRows.filter((h) => h.start_date < term.start_date);
    const last = baseline.at(-1);
    const lastShown = historyRows.filter((h) => h.start_date <= term.end_date).at(-1);
    const due = computeDue(teacher.rank, last ? { season: last.season, year: last.year } : null, term);

    const { rows: signUpRows } = await query(
      `SELECT a.*, cs.section_number, c.subject, c.course_number
         FROM assessments a
         JOIN course_sections cs ON cs.id = a.section_id
         JOIN courses c ON c.id = cs.course_id
        WHERE a.teacher_id = $1 AND a.due_term_id = $2 AND a.status <> 'not_eligible'`,
      [id, term.id],
    );
    const signUp = signUpRows
      .slice()
      .sort((a, b) => (SIGNUP_PRIORITY[b.status] ?? 0) - (SIGNUP_PRIORITY[a.status] ?? 0))[0] ?? null;

    const { rows: signUpObservations } = signUp
      ? await query('SELECT * FROM observations WHERE assessment_id = $1 ORDER BY attempt_no', [signUp.id])
      : { rows: [] };
    const status = currentStatusOf(signUp, signUpObservations);

    const summary = {
      id: teacher.id,
      firstName: teacher.first_name,
      lastName: teacher.last_name,
      email: teacher.email,
      school: teacher.school,
      department: teacher.department,
      isActive: teacher.is_active,
      rank: teacher.rank,
      rankLabel: rankLabel(teacher.rank),
      dueStatus: due.status,
      dueTerm: due.dueTerm,
      dueWindow: due.dueWindow,
      lastCompleted: lastShown
        ? {
          observationId: lastShown.observation_id,
          date: lastShown.scheduled_date,
          term: { id: lastShown.term_id, season: lastShown.season, year: lastShown.year },
        }
        : null,
      ...status,
      signUp: signUp
        ? {
          assessmentId: signUp.id,
          course: courseLabel(signUp.subject, signUp.course_number),
          section: signUp.section_number,
        }
        : null,
    };

    // Courses taught: the current report term, plus anything within the
    // observer-eligibility lookback window -- the same window that decides
    // whether this teacher can observe someone else.
    const { rows: lookbackRows } = await query(
      "SELECT value FROM app_settings WHERE key = 'observer_lookback_years'",
    );
    const lookbackYears = Number(lookbackRows[0]?.value ?? 2);
    const todayDate = new Date();
    const cutoffDate = new Date(todayDate);
    cutoffDate.setFullYear(cutoffDate.getFullYear() - lookbackYears);
    const cutoff = cutoffDate.toISOString().slice(0, 10);
    const today = todayDate.toISOString().slice(0, 10);

    const { rows: courseRows } = await query(
      `SELECT cs.id AS section_id, cs.section_number,
              tm.id AS term_id, tm.season, tm.year,
              c.subject, c.course_number, c.title, c.course_level, c.school AS course_school
         FROM course_sections cs
         JOIN terms tm ON tm.id = cs.term_id
         JOIN courses c ON c.id = cs.course_id
        WHERE cs.teacher_id = $1
          AND (tm.id = $2 OR (tm.start_date <= $3 AND tm.end_date >= $4))
        ORDER BY tm.start_date DESC`,
      [id, term.id, today, cutoff],
    );
    const courses = courseRows.map((c) => ({
      sectionId: c.section_id,
      sectionNumber: c.section_number,
      term: { id: c.term_id, season: c.season, year: c.year },
      thisTerm: c.term_id === term.id,
      course: courseLabel(c.subject, c.course_number),
      title: c.title,
      level: c.course_level,
      department: teacher.department,
      school: c.course_school,
    }));

    // Every observation this teacher has taken part in, either role.
    const { rows: obsRows } = await query(
      `SELECT o.*,
              cs.section_number, c.subject, c.course_number,
              tm.id AS term_id, tm.season, tm.year,
              observer.first_name AS observer_first_name, observer.last_name AS observer_last_name,
              observer.email AS observer_email, observer.rank AS observer_rank, observer.school AS observer_school,
              observee.first_name AS observee_first_name, observee.last_name AS observee_last_name,
              observee.email AS observee_email, observee.rank AS observee_rank, observee.school AS observee_school
         FROM observations o
         JOIN assessments a ON a.id = o.assessment_id
         JOIN course_sections cs ON cs.id = a.section_id
         JOIN courses c ON c.id = cs.course_id
         JOIN terms tm ON tm.id = a.due_term_id
         JOIN teachers observer ON observer.id = o.observer_id
         JOIN teachers observee ON observee.id = o.observee_id
        WHERE o.observer_id = $1 OR o.observee_id = $1
        ORDER BY o.scheduled_date DESC NULLS LAST`,
      [id],
    );
    const observations = obsRows.map((o) => {
      const given = o.observer_id === id;
      return {
        id: o.id,
        assessmentId: o.assessment_id,
        role: given ? 'observer' : 'observee',
        date: o.scheduled_date,
        status: o.status,
        partner: given
          ? {
            id: o.observee_id,
            firstName: o.observee_first_name,
            lastName: o.observee_last_name,
            email: o.observee_email,
            rank: o.observee_rank,
            school: o.observee_school,
          }
          : {
            id: o.observer_id,
            firstName: o.observer_first_name,
            lastName: o.observer_last_name,
            email: o.observer_email,
            rank: o.observer_rank,
            school: o.observer_school,
          },
        course: courseLabel(o.subject, o.course_number),
        term: { id: o.term_id, season: o.season, year: o.year },
      };
    });

    // §4.2: an observer takes at most OBSERVER_CAP observations per cycle;
    // postponed attempts don't count against the cap.
    const observerCount = observations.filter(
      (o) => o.role === 'observer' && o.term.id === term.id && o.status !== 'postponed',
    ).length;

    res.json({
      teacher: {
        id: teacher.id,
        firstName: teacher.first_name,
        lastName: teacher.last_name,
        email: teacher.email,
        rank: teacher.rank,
        school: teacher.school,
        department: teacher.department,
        isActive: teacher.is_active,
      },
      term: termBrief(term),
      summary,
      courses,
      observations,
      observerLoad: { count: observerCount, cap: OBSERVER_CAP },
      signUp: signUp
        ? {
          assessmentId: signUp.id,
          status: signUp.status,
          section: { id: signUp.section_id, sectionNumber: signUp.section_number },
          // The mock's attempt log (list_generated / request_sent / declined /
          // postponed / ...) has no real-schema equivalent yet -- there's no
          // table that records that history, only cancellation_attempts (a
          // narrower log of *cancellation* requests specifically, migration
          // 007) and the observations themselves. The closest faithful port
          // today is each attempt on this assessment that actually closed
          // (postponed / not_completed). Known gap -- flagged in the PR
          // description for a follow-up once there's a real event log.
          attempts: signUpObservations
            .filter((o) => CLOSING_OBSERVATION_STATUSES.includes(o.status))
            .map((o) => ({ attemptNo: o.attempt_no, type: o.status, date: o.scheduled_date })),
        }
        : null,
    });
  },
);

// GET /api/teachers/:id   (AC / admin, or the teacher themself)
router.get('/:id', validate(idParams, 'params'), async (req, res) => {
  const { id } = req.valid.params;
  const isSelf = req.user.teacherId === id;
  if (!isSelf && !AC_OR_ADMIN.includes(req.user.role)) {
    throw new HttpError(403, 'forbidden', 'You do not have permission to do that');
  }
  const { rows } = await query('SELECT * FROM teachers WHERE id = $1', [id]);
  if (!rows[0]) throw notFound('Teacher');
  res.json(toTeacher(rows[0]));
});

// POST /api/teachers   (AC / admin)
router.post('/', requireRole(...AC_OR_ADMIN), validate(createBody), async (req, res) => {
  const b = req.valid.body;
  const { rows } = await query(
    `INSERT INTO teachers (first_name, last_name, email, school, department, rank, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [b.firstName, b.lastName, b.email, b.school, b.department ?? b.school, b.rank, b.isActive ?? true],
  );
  res.status(201).json(toTeacher(rows[0]));
});

// PATCH /api/teachers/:id   (AC / admin) — partial update
router.patch('/:id', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), validate(updateBody), async (req, res) => {
  const { sets, values } = buildUpdate(req.valid.body, COLUMNS);
  const { rows } = await query(
    `UPDATE teachers SET ${sets.join(', ')} WHERE id = $${values.length + 1} RETURNING *`,
    [...values, req.valid.params.id],
  );
  if (!rows[0]) throw notFound('Teacher');
  res.json(toTeacher(rows[0]));
});

// DELETE /api/teachers/:id   (AC / admin) — SOFT delete (is_active = false).
// Teachers are referenced by teaching history and user accounts, so rows are never removed.
router.delete('/:id', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), async (req, res) => {
  const { rowCount } = await query('UPDATE teachers SET is_active = FALSE WHERE id = $1', [req.valid.params.id]);
  if (!rowCount) throw notFound('Teacher');
  res.status(204).end();
});

export default router;
