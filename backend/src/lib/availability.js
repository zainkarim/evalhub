// Observer/observee availability checks (professor fixes #4 and #3's deferred
// half: proposed observation dates must land when the person involved is
// actually free, not just be a real UTD meeting-pattern date in the
// abstract). Used by:
//   - POST /assessments/:id/time-options        (the observee proposing dates)
//   - POST /assessments/:id/time-options/send   (checking the chosen observer)
//   - POST /time-options/:id/confirm            (defensive re-check)
//
// A teacher is "busy" at a given date + time window if either:
//   1. They are scheduled to teach a class that meets on that day of the
//      week, with an overlapping time range, during a term that covers that
//      date (course_sections + terms); or
//   2. They already have a CONFIRMED observation time slot that overlaps it
//      -- whether they're the observer (offered_to_teacher_id) or the
//      observee (assessments.teacher_id) on that slot.
//
// This intentionally only looks at *confirmed* time options for #2 -- a
// merely-proposed or merely-offered option isn't a real commitment yet, and
// treating it as one would make the first person to propose a date block
// out candidates for anyone else before anything is actually settled. The
// "observee selects one of several observers' confirmed times without
// double-booking themselves" piece (fix #6) reuses this same check.
import { query } from '../db/pool.js';

// JS Date#getUTCDay(): 0=Sunday .. 6=Saturday. UTD's section meeting_days
// strings use single-letter day codes drawn from this same ordering
// (U=Sun, M=Mon, T=Tue, W=Wed, R=Thu, F=Fri, S=Sat) -- 'MW', 'TR', 'F', 'W', etc.
const DAY_CODES = ['U', 'M', 'T', 'W', 'R', 'F', 'S'];

export function dayCodeFor(dateStr) {
  // Parsed as a UTC midnight so the weekday doesn't shift with server TZ.
  return DAY_CODES[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
}

const toHHMM = (t) => (t ? t.slice(0, 5) : t); // 'HH:MM:SS' -> 'HH:MM'

export function timesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Returns a short description of what's blocking this teacher at this date +
 * time window, or null if they're free.
 */
export async function findTeacherConflict(teacherId, date, startTime, endTime) {
  const dayCode = dayCodeFor(date);

  const { rows: teaching } = await query(
    `SELECT cs.meeting_days, cs.start_time, cs.end_time, c.subject, c.course_number, cs.section_number
       FROM course_sections cs
       JOIN courses c ON c.id = cs.course_id
       JOIN terms tm  ON tm.id = cs.term_id
      WHERE cs.teacher_id = $1
        AND cs.start_time IS NOT NULL
        AND cs.end_time IS NOT NULL
        AND strpos(cs.meeting_days, $2) > 0
        AND tm.start_date <= $3::date
        AND tm.end_date   >= $3::date`,
    [teacherId, dayCode, date],
  );

  for (const row of teaching) {
    const rowStart = toHHMM(row.start_time);
    const rowEnd = toHHMM(row.end_time);
    if (timesOverlap(startTime, endTime, rowStart, rowEnd)) {
      return {
        reason: 'teaching',
        detail: `teaching ${row.subject}${row.course_number}.${row.section_number} (${row.meeting_days} ${rowStart}-${rowEnd}) at that time`,
      };
    }
  }

  const { rows: commitments } = await query(
    `SELECT ato.start_time, ato.end_time
       FROM assessment_time_options ato
       JOIN assessments a ON a.id = ato.assessment_id
      WHERE ato.is_confirmed
        AND ato.proposed_date = $2::date
        AND (ato.offered_to_teacher_id = $1 OR a.teacher_id = $1)`,
    [teacherId, date],
  );

  for (const row of commitments) {
    const rowStart = toHHMM(row.start_time);
    const rowEnd = toHHMM(row.end_time);
    if (timesOverlap(startTime, endTime, rowStart, rowEnd)) {
      return {
        reason: 'already_booked',
        detail: `already has a confirmed observation that day (${rowStart}-${rowEnd})`,
      };
    }
  }

  return null;
}
