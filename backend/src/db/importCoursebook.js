// Imports courses, sections, and the teachers who taught them from UTD's
// Nebula Labs API (the backend behind Coursebook, UT Dallas Trends, and
// Skedge), as a one-off/periodic alternative to hand-entering course data.
// Referenced in migration 001's course_sections comment ("the UTD Course
// Book integration will write here") and in both courses.source and
// course_sections.source's 'coursebook' enum value, which already existed
// before this script did.
//
// *** IMPORTANT -- READ BEFORE RUNNING AGAINST THE REAL API ***
// Paths and field shapes below are confirmed against the real Swagger spec
// at https://api.utdnebula.com/swagger/doc.json (fetched directly -- this
// sandbox can reach that over plain HTTPS fetch, just not from the shell/curl
// proxy, which is what made earlier testing here impossible). One thing is
// still a live unknown:
//
//   AUTH: every real endpoint (confirmed live: GET /course/all, /course,
//   /professor) returns 401 with
//     {"code":401,"message":"UNAUTHENTICATED: Method doesn't allow
//      unregistered callers (callers without established identity). Please
//      use API Key or other form of API consumer identity to call this API."}
//   for an unauthenticated request. That exact message is the stock error
//   text from Google Cloud API Gateway / ESPv2 -- which also means the key
//   requirement is enforced at a gateway in front of the API, not in the
//   app's own Swagger spec (there's no securityDefinitions block in it).
//   Google's gateway convention is either an `x-api-key` header or a `key=`
//   query param; this script tries the header by default. There is no public
//   signup page for a key -- the Nebula Labs Discord (https://discord.utdnebula.com/)
//   is the only access-request path I could find. Get a key there, then run:
//     NEBULA_API_KEY=xxx npm run import:coursebook
//   If it's still a 401 with the header, set NEBULA_API_KEY_MODE=query to
//   send it as ?key=xxx instead.
//
// Confirmed from the Swagger spec (not guesses anymore):
//   - Real paths have NO /api prefix: /course/all, /course (search),
//     /section/{id}, /section (search), /professor, /professor/{id}.
//   - course.school exists; there's still no department field anywhere.
//   - section.meetings is an array of
//     { start_date, end_date, meeting_days, start_time, end_time, modality,
//       location: { building, room, map_uri } }
//     -- meeting_days is a plain string already (matches our own column), and
//     location is a nested object, not a flat string.
// Still unconfirmed because the Swagger fetch got cut off before reaching it:
//   - The exact string format of academic_session.name (e.g. "Fall 2024" vs
//     "2024 Fall") -- parseAcademicSession() handles the likely formats and
//     throws with the raw string if it hits something else, so it's a quick
//     fix once you see a real one.
//
// Usage: node --env-file=.env src/db/importCoursebook.js
// Safe to re-run: every write is an upsert keyed on the same natural keys
// the rest of the schema already uses (courses: subject+course_number;
// course_sections: course_id+term_id+section_number; teachers: lower(email)),
// and only touches course/section rows whose source is already 'coursebook'
// (or that don't exist yet) -- it never overwrites a manually-entered or
// seeded row, so it's safe to run alongside hand-curated data.

import { config } from '../config.js';
import { pool, query } from './pool.js';

if (config.env === 'production' && process.env.ALLOW_COURSEBOOK_IMPORT_IN_PROD !== 'true') {
  console.error('Refusing to run against production without ALLOW_COURSEBOOK_IMPORT_IN_PROD=true');
  process.exit(1);
}

const API_BASE = process.env.NEBULA_API_BASE ?? 'https://api.utdnebula.com';
const API_KEY = process.env.NEBULA_API_KEY; // unset = send no auth at all -- will 401, see header note above
const API_KEY_HEADER = process.env.NEBULA_API_KEY_HEADER ?? 'x-api-key';
// 'header' (default) sends NEBULA_API_KEY as the x-api-key header; 'query'
// sends it as ?key=... instead, in case this gateway wants it that way.
const API_KEY_MODE = process.env.NEBULA_API_KEY_MODE ?? 'header';

async function fetchJson(path) {
  const url = new URL(path, API_BASE);
  const headers = {};
  if (API_KEY) {
    if (API_KEY_MODE === 'query') url.searchParams.set('key', API_KEY);
    else headers[API_KEY_HEADER] = API_KEY;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}: ${await res.text().catch(() => '(no body)')}`);
  }
  return res.json();
}

// 'Fall 2024' / '2024 Fall' / 'Fall24' / 'fall 24' -> { season, year }.
// Extend this if a real response uses a format not listed here -- the error
// includes the raw string so that's a quick fix, not a guessing game.
function parseAcademicSession(name) {
  const seasons = { fall: 'fall', spring: 'spring', summer: 'summer' };
  const m = String(name).toLowerCase().match(/(fall|spring|summer)\D*(\d{2,4})|(\d{2,4})\D*(fall|spring|summer)/);
  if (!m) throw new Error(`Can't parse academic_session.name: "${name}" -- update parseAcademicSession()`);
  const season = seasons[m[1] ?? m[4]];
  let year = Number(m[2] ?? m[3]);
  if (year < 100) year += 2000;
  return { season, year };
}

// Confirmed shape (from the real Swagger spec, see file header): each entry
// is { start_date, end_date, meeting_days, start_time, end_time, modality,
// location: { building, room, map_uri } }. Still defensive about a field
// being missing/null on an individual section (e.g. an online-only section
// with modality set but no meeting_days) -- that's a real, valid case, not a
// parsing failure, so it logs and returns null rather than throwing.
function parseMeetings(meetings, sectionLabel) {
  if (!Array.isArray(meetings) || meetings.length === 0) return null;
  const m = meetings[0]; // first meeting pattern only; UTD sections are rarely split further
  const days = m.meeting_days ?? null;
  const startTime = m.start_time ?? null;
  const endTime = m.end_time ?? null;
  if (!days || !startTime || !endTime) {
    console.warn(`  ! ${sectionLabel}: no meeting_days/start_time/end_time (modality: ${m.modality ?? 'unknown'}) -- leaving time fields blank`);
    return null;
  }
  const location = m.location?.building && m.location?.room ? `${m.location.building} ${m.location.room}` : null;
  return { days, startTime, endTime, location };
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
    [c.subject_prefix, c.school, c.course_number, c.title, c._id],
  );
  if (rows[0]) return rows[0].id;
  // Conflict existed but WHERE excluded it (a manual/seed row already owns
  // this subject+course_number) -- look the id up without touching it.
  const existing = await query('SELECT id FROM courses WHERE subject = $1 AND course_number = $2', [c.subject_prefix, c.course_number]);
  return existing.rows[0]?.id ?? null;
}

const professorCache = new Map(); // nebula professor _id -> our teacher.id

async function upsertTeacherFromProfessorId(professorId, fallbackSchool, fallbackDepartment) {
  if (professorCache.has(professorId)) return professorCache.get(professorId);

  const prof = await fetchJson(`/professor/${professorId}`);
  if (!prof?.email) {
    console.warn(`  ! professor ${professorId} has no email -- skipping (can't match/create a teacher without one)`);
    return null;
  }

  const { rows: existing } = await query('SELECT id FROM teachers WHERE lower(email) = lower($1)', [prof.email]);
  if (existing[0]) {
    professorCache.set(professorId, existing[0].id);
    return existing[0].id;
  }

  // New teacher: we only have a name/email from Nebula, not rank or a real
  // department -- both are guessed and logged so someone reviews them later
  // rather than them silently becoming load-bearing data (same caveat
  // migration 005 documents for its own school-fallback case).
  console.warn(`  ! creating new teacher for ${prof.email} with a GUESSED rank ('assistant_professor') and department ('${fallbackDepartment}') -- review this`);
  const { rows: inserted } = await query(
    `INSERT INTO teachers (first_name, last_name, email, school, department, rank)
     VALUES ($1, $2, $3, $4, $5, 'assistant_professor')
     RETURNING id`,
    [prof.first_name ?? 'Unknown', prof.last_name ?? 'Unknown', prof.email, fallbackSchool, fallbackDepartment],
  );
  professorCache.set(professorId, inserted[0].id);
  return inserted[0].id;
}

async function upsertSection(courseId, courseLabel, s) {
  const { season, year } = parseAcademicSession(s.academic_session?.name);
  const termId = await upsertTerm(season, year, s.academic_session.start_date, s.academic_session.end_date);

  const meeting = parseMeetings(s.meetings, `${courseLabel}.${s.section_number}`);

  let teacherId = null;
  if (Array.isArray(s.professors) && s.professors.length > 0) {
    // One instructor of record per section in our schema; first listed wins.
    const [courseRow] = (await query('SELECT school, subject FROM courses WHERE id = $1', [courseId])).rows;
    teacherId = await upsertTeacherFromProfessorId(s.professors[0], courseRow?.school, courseRow?.subject);
  }

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
    [courseId, termId, s.section_number, teacherId, meeting?.days ?? null, meeting?.startTime ?? null, meeting?.endTime ?? null, meeting?.location ?? null, s._id],
  );
}

async function run() {
  console.log(`Importing from ${API_BASE} ...`);

  const courses = await fetchJson('/course/all');
  console.log(`Fetched ${courses.length} courses`);

  let sectionCount = 0;
  let skippedCourses = 0;

  for (const c of courses) {
    const courseId = await upsertCourse(c);
    if (!courseId) {
      skippedCourses += 1;
      continue;
    }

    const courseLabel = `${c.subject_prefix}${c.course_number}`;
    // Docs list `sections` on the course object itself (likely an array of
    // section ids/refs, not the sections inline) -- fetch each section's
    // full record explicitly rather than assume it's embedded.
    const sectionRefs = Array.isArray(c.sections) ? c.sections : [];
    for (const ref of sectionRefs) {
      const sectionId = typeof ref === 'string' ? ref : ref?._id;
      if (!sectionId) continue;
      try {
        const section = await fetchJson(`/section/${sectionId}`);
        await upsertSection(courseId, courseLabel, section);
        sectionCount += 1;
      } catch (err) {
        console.warn(`  ! ${courseLabel} section ${sectionId}: ${err.message} -- skipped`);
      }
    }
  }

  console.log(`Done. Upserted sections for ${sectionCount} sections (${skippedCourses} courses skipped -- already owned by a manual/seed row).`);
}

try {
  await run();
} catch (err) {
  console.error('Import failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
