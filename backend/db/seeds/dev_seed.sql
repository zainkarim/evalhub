-- =====================================================================
-- Development seed — ALL DATA IS SYNTHETIC. Never run against production.
-- Instructors are personas (Professor A, B, C, ...) — real names must not be used
-- (9/11 meeting summary). Term dates are approximate placeholders.
-- =====================================================================

TRUNCATE process_feedback, observations, observer_candidates, candidate_lists, assessments,
         evaluation_criteria, app_settings, course_sections, courses, users, teachers, terms
  RESTART IDENTITY CASCADE;

INSERT INTO terms (id, season, year, start_date, end_date) VALUES
  ( 1, 'fall',   2023, '2023-08-21', '2023-12-15'),
  ( 2, 'spring', 2024, '2024-01-08', '2024-05-10'),
  ( 3, 'summer', 2024, '2024-05-20', '2024-08-09'),
  ( 4, 'fall',   2024, '2024-08-19', '2024-12-13'),
  ( 5, 'spring', 2025, '2025-01-13', '2025-05-09'),
  ( 6, 'summer', 2025, '2025-05-19', '2025-08-08'),
  ( 7, 'fall',   2025, '2025-08-18', '2025-12-12'),
  ( 8, 'spring', 2026, '2026-01-12', '2026-05-08'),
  ( 9, 'summer', 2026, '2026-05-18', '2026-08-07'),
  (10, 'fall',   2026, '2026-08-17', '2026-12-11'),
  (11, 'spring', 2027, '2027-01-11', '2027-05-07');

-- department (professor correction 10/13, migration 005_teacher_department.sql):
-- the real observer-matching key, finer-grained than school -- see that
-- migration's header for why. Set directly here (rather than relying on
-- the migration's own historical backfill) so a fresh `migrate && seed` run
-- produces correct, non-placeholder departments for every seeded teacher.
INSERT INTO teachers (id, first_name, last_name, email, school, department, rank) VALUES
  ( 1, 'Professor', 'A', 'professor.a@example.edu', 'ECS',  'CS',   'associate_professor'),
  ( 2, 'Professor', 'B', 'professor.b@example.edu', 'ECS',  'CS',   'full_professor'),
  ( 3, 'Professor', 'C', 'professor.c@example.edu', 'ECS',  'CS',   'assistant_professor'),
  ( 4, 'Professor', 'D', 'professor.d@example.edu', 'ECS',  'CS',   'associate_professor'),
  ( 5, 'Professor', 'E', 'professor.e@example.edu', 'ECS',  'CS',   'assistant_professor'),
  ( 6, 'Professor', 'F', 'professor.f@example.edu', 'ECS',  'CS',   'full_professor'),
  ( 7, 'Professor', 'G', 'professor.g@example.edu', 'ECS',  'CS',   'associate_professor'),
  ( 8, 'Professor', 'H', 'professor.h@example.edu', 'ECS',  'CS',   'assistant_professor'),
  ( 9, 'Professor', 'I', 'professor.i@example.edu', 'EPPS', 'EPPS', 'full_professor'),
  (10, 'Professor', 'J', 'professor.j@example.edu', 'EPPS', 'EPPS', 'associate_professor');

INSERT INTO courses (id, subject, school, course_number, title, source) VALUES
  (1, 'CS',   'ECS',  '1337', 'Computer Science I',             'seed'),
  (2, 'CS',   'ECS',  '2305', 'Discrete Mathematics',           'seed'),
  (3, 'CS',   'ECS',  '3345', 'Data Structures and Algorithms', 'seed'),
  (4, 'CS',   'ECS',  '3354', 'Software Engineering',           'seed'),
  (5, 'CS',   'ECS',  '4348', 'Operating Systems Concepts',     'seed'),
  (6, 'CS',   'ECS',  '4485', 'Computer Science Project',       'seed'),
  (7, 'CS',   'ECS',  '6360', 'Database Design',                'seed'),
  (8, 'EPPS', 'EPPS', '4310', 'Policy Research Methods',        'seed');  -- synthetic EPPS course

-- Meeting times (fix #4, professor feedback 10/13): real UTD-style class
-- meeting patterns instead of arbitrary one-off dates/times. Two-day
-- patterns (MW, TR) are 75-minute lecture blocks; single-day patterns (F,
-- W alone) are the once-a-week ~165-minute blocks UTD typically uses for
-- labs/project courses and once-weekly graduate seminars (e.g. CS 6360,
-- CS 4485). These times, together with each section's term start/end
-- dates, are what src/lib/availability.js checks a teacher's own schedule
-- against before a date can be proposed to or confirmed by them.
INSERT INTO course_sections (id, course_id, term_id, section_number, teacher_id, meeting_days, start_time, end_time, source) VALUES
  ( 1, 3,  4, '001',  1, 'MW', '13:00', '14:15', 'seed'),  -- CS 3345  Fall 2024    Prof A
  ( 2, 5,  4, '001',  1, 'TR', '11:00', '12:15', 'seed'),  -- CS 4348  Fall 2024    Prof A
  ( 3, 6,  5, '001',  2, 'F',  '09:00', '11:45', 'seed'),  -- CS 4485  Spring 2025  Prof B
  ( 4, 1,  5, '001',  8, 'MW', '10:00', '11:15', 'seed'),  -- CS 1337  Spring 2025  Prof H
  ( 5, 5,  2, '001',  7, 'TR', '14:00', '15:15', 'seed'),  -- CS 4348  Spring 2024  Prof G    (outside 2-yr window)
  ( 6, 2,  4, '001',  7, 'MW', '09:00', '10:15', 'seed'),  -- CS 2305  Fall 2024    Prof G
  ( 7, 4,  7, '001',  4, 'TR', '12:30', '13:45', 'seed'),  -- CS 3354  Fall 2025    Prof D
  ( 8, 5,  7, '001',  4, 'MW', '14:00', '15:15', 'seed'),  -- CS 4348  Fall 2025    Prof D
  ( 9, 6,  7, '001',  6, 'F',  '13:00', '15:45', 'seed'),  -- CS 4485  Fall 2025    Prof F
  (10, 3,  7, '001',  8, 'TR', '08:00', '09:15', 'seed'),  -- CS 3345  Fall 2025    Prof H
  (11, 7,  7, '001',  2, 'W',  '16:00', '18:45', 'seed'),  -- CS 6360  Fall 2025    Prof B (evening grad seminar)
  (12, 1,  7, '001',  3, 'MW', '11:30', '12:45', 'seed'),  -- CS 1337  Fall 2025    Prof C
  (13, 8,  7, '001',  9, 'TR', '09:30', '10:45', 'seed'),  -- EPPS 4310 Fall 2025    Prof I
  (14, 3,  8, '001',  6, 'MW', '13:00', '14:15', 'seed'),  -- CS 3345  Spring 2026  Prof F
  (15, 4,  8, '001',  7, 'TR', '15:00', '16:15', 'seed'),  -- CS 3354  Spring 2026  Prof G
  (16, 6,  8, '001',  2, 'F',  '10:00', '12:45', 'seed'),  -- CS 4485  Spring 2026  Prof B
  (17, 2,  8, '001',  3, 'MW', '08:00', '09:15', 'seed'),  -- CS 2305  Spring 2026  Prof C
  (18, 8,  8, '001', 10, 'TR', '13:00', '14:15', 'seed'),  -- EPPS 4310 Spring 2026  Prof J
  (19, 4, 10, '001',  2, 'MW', '10:00', '11:15', 'seed'),  -- CS 3354  Fall 2026    Prof B
  (20, 4, 10, '002',  5, 'TR', '11:00', '12:15', 'seed'),  -- CS 3354  Fall 2026    Prof E
  (21, 1, 10, '001',  3, 'MW', '09:00', '10:15', 'seed'),  -- CS 1337  Fall 2026    Prof C
  (22, 6, 10, '001',  6, 'F',  '14:00', '16:45', 'seed');  -- CS 4485  Fall 2026    Prof F

-- Sample assessments (sign-ups): Prof C is due (assistant professor, past
-- first semester) and has signed up with two different sections she teaches
-- (Q&A 18: multiple sign-ups allowed, one per section).
INSERT INTO app_settings (key, value, description) VALUES
  ('candidate_list_size',     '5',                    'Exactly this many observer candidates are surfaced per request (Q&A 15)'),
  ('observer_lookback_years', '2',                    'Observer must have taught the target level, in the same school, within this many years (Q&A 8)'),
  ('retry_window_weeks',      '{"min": 3, "max": 4}', 'If an observation does not happen, retry within this window, then AC / postponement (9/11 summary)');

INSERT INTO assessments (id, teacher_id, section_id, due_term_id, status) VALUES
  (1, 3, 21, 10, 'signed_up'),  -- Prof C, CS 1337 section, Fall 2026
  (2, 3, 17, 8,  'completed');  -- Prof C, CS 2305 section, Spring 2026 (past example)

INSERT INTO evaluation_criteria (name, description, weight, max_score, sort_order) VALUES
  ('Instructional clarity',  'Explanations are clear and well paced',            1.0, 5, 1),
  ('Student engagement',     'Students are actively involved in the lesson',     1.0, 5, 2),
  ('Course organization',    'Lesson objectives and structure are evident',      1.0, 5, 3);

-- Keep identity sequences ahead of the explicit ids inserted above.
SELECT setval(pg_get_serial_sequence('terms',           'id'), (SELECT max(id) FROM terms));
SELECT setval(pg_get_serial_sequence('teachers',        'id'), (SELECT max(id) FROM teachers));
SELECT setval(pg_get_serial_sequence('courses',         'id'), (SELECT max(id) FROM courses));
SELECT setval(pg_get_serial_sequence('course_sections', 'id'), (SELECT max(id) FROM course_sections));
SELECT setval(pg_get_serial_sequence('assessments',       'id'), (SELECT max(id) FROM assessments));
SELECT setval(pg_get_serial_sequence('evaluation_criteria','id'), (SELECT max(id) FROM evaluation_criteria));
