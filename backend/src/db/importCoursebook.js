// Imports real UTD courses, sections, and meeting times from the Nebula Labs
// API (the backend behind Coursebook, UT Dallas Trends, and Skedge), scoped to
// one department's in-person lecture sections for a few terms.
//
// Instructors are PSEUDONYMIZED. The project rule is that professor names are
// always fictional (docs/requirements.md §4.7), so this script never requests
// /professor records at all. Each instructor gets a stable fake identity
// derived from their Nebula professor id: "Professor <3 letters>" and
// prof-<hash>@example.edu. Re-running the import maps the same instructor to the
// same fake teacher, so teaching history accumulates correctly across terms.
//
// Scope (10/14 review: focus on regular in-person classes; online and lab
// sections are edge cases):
//   - subjects: NEBULA_SUBJECTS (default "CS")
//   - terms:    NEBULA_TERMS, Nebula session names (default "25F,26S,26F")
//   - keeps instruction_mode "Face-to-Face" only
//   - skips Laboratory courses and lab sections (section numbers with an L)
//   - skips sections with no meeting days/times
//
// API shapes, confirmed live on 2026-10-18:
//   - every response is { status, message, data }
//   - list endpoints page 20 at a time via ?offset=
//   - academic_session.name looks like "25F" / "26S" / "19U" (U = summer)
//   - meetings[].meeting_days is an array of day names (["Tuesday", "Thursday"])
//   - start_time / end_time look like "3:00pm"
//   - the same course appears once per catalog year (different _id per year)
//
// Usage: NEBULA_API_KEY=... npm run import:coursebook
//        add --dry-run to fetch and filter without writing anything.
// Requests: about 50 for a subject's courses plus about 230 per term.
//
// Safe to re-run: writes are upserts on the schema's natural keys and only
// touch course/section rows whose source is already 'coursebook' (or that
// don't exist yet), so seeded or hand-entered rows are never overwritten.

import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { pool, query } from './pool.js';

if (config.env === 'production' && process.env.ALLOW_COURSEBOOK_IMPORT_IN_PROD !== 'true') {
  console.error('Refusing to run against production without ALLOW_COURSEBOOK_IMPORT_IN_PROD=true');
  process.exit(1);
}

const API_BASE = process.env.NEBULA_API_BASE ?? 'https://api.utdnebula.com';
const API_KEY = process.env.NEBULA_API_KEY;
const API_KEY_HEADER = process.env.NEBULA_API_KEY_HEADER ?? 'x-api-key';
const SUBJECTS = (process.env.NEBULA_SUBJECTS ?? 'CS').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
const TERMS = (process.env.NEBULA_TERMS ?? '25F,26S,26F').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
const DRY_RUN = process.argv.includes('--dry-run');
const PAGE_SIZE = 20; // fixed by the API

if (!API_KEY) {
  console.error('NEBULA_API_KEY is not set (add it to backend/.env; never commit it)');
  process.exit(1);
}

async function fetchData(path) {
  const url = new URL(path, API_BASE);
  const res = await fetch(url, { headers: { [API_KEY_HEADER]: API_KEY } });
  if (!res.ok) {
    throw new Error(`${url.pathname}${url.search} -> HTTP ${res.status}: ${await res.text().catch(() => '(no body)')}`);
  }
  const body = await res.json();
  return body.data ?? null;
}

// Pages through a list endpoint until a short or empty page comes back.
async function fetchAll(path) {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const sep = path.includes('?') ? '&' : '?';
    const page = (await fetchData(`${path}${sep}offset=${offset}`)) ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) return all;
  }
}

// "25F" -> { season: 'fall', year: 2025 }
const SEASON_CODES = { F: 'fall', S: 'spring', U: 'summer' };
function parseSession(name) {
  const m = /^(\d{2})([FSU])$/.exec(String(name).trim().toUpperCase());
  if (!m) throw new Error(`Can't parse academic_session.name "${name}" (expected e.g. 25F, 26S, 19U)`);
  return { season: SEASON_CODES[m[2]], year: 2000 + Number(m[1]) };
}

// ["Tuesday", "Thursday"] -> "TR", using the day codes in src/lib/availability.js
const DAY_CODES = { Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'R', Friday: 'F', Saturday: 'S', Sunday: 'U' };
const DAY_ORDER = 'UMTWRFS';
function toDayCode(days) {
  const codes = (Array.isArray(days) ? days : []).map((d) => DAY_CODES[d]).filter(Boolean);
  return [...new Set(codes)].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).join('') || null;
}

// "3:00pm" -> "15:00"; "12:30pm" -> "12:30"; "12:00am" -> "00:00"
function to24h(time) {
  const m = /^(\d{1,2}):(\d{2})\s*([ap])m$/i.exec(String(time).trim());
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'p') hour += 12;
  return `${String(hour).padStart(2, '0')}:${m[2]}`;
}

function parseMeeting(meetings) {
  const m = Array.isArray(meetings) ? meetings[0] : null; // first meeting pattern only
  if (!m) return null;
  const days = toDayCode(m.meeting_days);
  const startTime = to24h(m.start_time);
  const endTime = to24h(m.end_time);
  if (!days || !startTime || !endTime) return null;
  const location = m.location?.building && m.location?.room ? `${m.location.building} ${m.location.room}` : null;
  return { days, startTime, endTime, location };
}

// Nebula reports the full school name; the schema uses short codes.
function schoolCode(name) {
  return /jonsson/i.test(name ?? '') ? 'ECS' : (name ?? 'UNKNOWN');
}

// Stable fictional identity from the Nebula professor id. No real name or
// email is fetched or stored. `length` grows only if the shorter name is
// already taken by a different teacher.
function pseudonym(professorId, length = 3) {
  const hash = createHash('sha256').update(String(professorId)).digest('hex');
  const letters = Array.from({ length }, (_, i) =>
    String.fromCharCode(65 + (parseInt(hash.slice(i * 2, i * 2 + 2), 16) % 26))).join('');
  return { firstName: 'Professor', lastName: letters, email: `prof-${hash.slice(0, 12)}@example.edu` };
}

async function upsertTerm(season, year, startDate, endDate) {
  const { rows } = await query(
    `INSERT INTO terms (season, year, start_date, end_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (year, season) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date
     RETURNING id`,
    [season, year, startDate, endDate],
  );
  return rows[0].id;
}

async function upsertCourse(c) {
  const { rows } = await query(
    `INSERT INTO courses (subject, school, course_number, title, source, external_id)
     VALUES ($1, $2, $3, $4, 'coursebook', $5)
     ON CONFLICT (subject, course_number) DO UPDATE
        SET title = EXCLUDED.title, school = EXCLUDED.school, external_id = EXCLUDED.external_id, updated_at = now()
      WHERE courses.source = 'coursebook'
     RETURNING id`,
    [c.subject_prefix, schoolCode(c.school), c.course_number, c.title, c._id],
  );
  if (rows[0]) return rows[0].id;
  // A seeded/manual row already owns this subject+number: use it, don't touch it.
  const existing = await query('SELECT id FROM courses WHERE subject = $1 AND course_number = $2', [c.subject_prefix, c.course_number]);
  return existing.rows[0]?.id ?? null;
}

const teacherCache = new Map(); // nebula professor id -> teachers.id
let newTeachers = 0;

async function upsertPseudonymousTeacher(professorId, school, department) {
  if (teacherCache.has(professorId)) return teacherCache.get(professorId);
  const p = pseudonym(professorId);

  const { rows: existing } = await query('SELECT id FROM teachers WHERE lower(email) = lower($1)', [p.email]);
  if (existing[0]) {
    teacherCache.set(professorId, existing[0].id);
    return existing[0].id;
  }

  // Keep display names unique so two instructors never look identical in the UI.
  let name = p;
  for (let length = 4; ; length += 1) {
    const { rows: taken } = await query(
      "SELECT 1 FROM teachers WHERE first_name = $1 AND last_name = $2",
      [name.firstName, name.lastName],
    );
    if (!taken[0]) break;
    name = pseudonym(professorId, length);
  }

  // Nebula doesn't give rank; default to assistant_professor (the AC or the
  // professor can correct it later, see #50).
  const { rows } = await query(
    `INSERT INTO teachers (first_name, last_name, email, school, department, rank)
     VALUES ($1, $2, $3, $4, $5, 'assistant_professor')
     RETURNING id`,
    [name.firstName, name.lastName, p.email, school, department],
  );
  newTeachers += 1;
  teacherCache.set(professorId, rows[0].id);
  return rows[0].id;
}

async function run() {
  console.log(`Importing ${SUBJECTS.join(', ')} for terms ${TERMS.join(', ')} from ${API_BASE}${DRY_RUN ? ' (dry run)' : ''}`);

  // 1. Course records for the chosen subjects, keyed by Nebula _id (one per catalog year).
  const coursesById = new Map();
  for (const subject of SUBJECTS) {
    const records = await fetchAll(`/course?subject_prefix=${encodeURIComponent(subject)}`);
    for (const c of records) coursesById.set(c._id, c);
    console.log(`  ${subject}: ${records.length} course records`);
  }

  const skipped = { otherSubject: 0, notInPerson: 0, lab: 0, noMeetingTime: 0, badCourseNumber: 0 };
  const keep = [];

  // 2. Each term's sections, filtered to in-person lecture sections of those courses.
  for (const term of TERMS) {
    parseSession(term); // fail fast on a typo before paging ~230 requests
    const sections = await fetchAll(`/section?academic_session.name=${encodeURIComponent(term)}`);
    let kept = 0;
    for (const s of sections) {
      const course = coursesById.get(s.course_reference);
      if (!course) { skipped.otherSubject += 1; continue; }
      if (s.instruction_mode !== 'Face-to-Face') { skipped.notInPerson += 1; continue; }
      if (course.activity_type === 'Laboratory' || /L/i.test(s.section_number)) { skipped.lab += 1; continue; }
      if (!/^\d{4}$/.test(course.course_number)) { skipped.badCourseNumber += 1; continue; }
      const meeting = parseMeeting(s.meetings);
      if (!meeting) { skipped.noMeetingTime += 1; continue; }
      keep.push({ course, section: s, meeting });
      kept += 1;
    }
    console.log(`  ${term}: ${sections.length} sections campus-wide, ${kept} kept`);
  }

  console.log(`Keeping ${keep.length} sections; skipped ${JSON.stringify(skipped)}`);
  if (DRY_RUN) return;

  // 3. Write.
  let written = 0;
  for (const { course, section: s, meeting } of keep) {
    const courseId = await upsertCourse(course);
    if (!courseId) continue;
    const { season, year } = parseSession(s.academic_session.name);
    const termId = await upsertTerm(season, year, s.academic_session.start_date.slice(0, 10), s.academic_session.end_date.slice(0, 10));
    const professorId = Array.isArray(s.professors) ? s.professors[0] : null;
    const teacherId = professorId
      ? await upsertPseudonymousTeacher(professorId, schoolCode(course.school), course.subject_prefix)
      : null;

    await query(
      `INSERT INTO course_sections
         (course_id, term_id, section_number, teacher_id, meeting_days, start_time, end_time, location, source, external_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'coursebook', $9)
       ON CONFLICT (course_id, term_id, section_number) DO UPDATE
          SET teacher_id   = EXCLUDED.teacher_id,
              meeting_days = EXCLUDED.meeting_days,
              start_time   = EXCLUDED.start_time,
              end_time     = EXCLUDED.end_time,
              location     = EXCLUDED.location,
              external_id  = EXCLUDED.external_id,
              updated_at   = now()
        WHERE course_sections.source = 'coursebook'`,
      [courseId, termId, s.section_number, teacherId, meeting.days, meeting.startTime, meeting.endTime, meeting.location, s._id],
    );
    written += 1;
  }

  console.log(`Done. Upserted ${written} sections; created ${newTeachers} pseudonymous teachers (rank defaults to assistant_professor).`);
}

try {
  await run();
} catch (err) {
  console.error('Import failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
