-- =====================================================================
-- Development seed — ALL DATA IS SYNTHETIC. Never run against production.
-- Instructors are personas (Professor A, B, C, ...) — real names must not be used
-- (9/11 meeting summary). Term dates are approximate placeholders.
-- =====================================================================

TRUNCATE course_sections, courses, users, teachers, terms RESTART IDENTITY CASCADE;

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

INSERT INTO teachers (id, first_name, last_name, email, school, rank) VALUES
  ( 1, 'Professor', 'A', 'professor.a@example.edu', 'ECS', 'associate_professor'),
  ( 2, 'Professor', 'B', 'professor.b@example.edu', 'ECS', 'full_professor'),
  ( 3, 'Professor', 'C', 'professor.c@example.edu', 'ECS', 'assistant_professor'),
  ( 4, 'Professor', 'D', 'professor.d@example.edu', 'ECS', 'associate_professor'),
  ( 5, 'Professor', 'E', 'professor.e@example.edu', 'ECS', 'assistant_professor'),
  ( 6, 'Professor', 'F', 'professor.f@example.edu', 'ECS', 'full_professor'),
  ( 7, 'Professor', 'G', 'professor.g@example.edu', 'ECS', 'associate_professor'),
  ( 8, 'Professor', 'H', 'professor.h@example.edu', 'ECS', 'assistant_professor'),
  ( 9, 'Professor', 'I', 'professor.i@example.edu', 'EPPS', 'full_professor'),
  (10, 'Professor', 'J', 'professor.j@example.edu', 'EPPS', 'associate_professor');

INSERT INTO courses (id, subject, school, course_number, title, source) VALUES
  (1, 'CS',   'ECS',  '1337', 'Computer Science I',             'seed'),
  (2, 'CS',   'ECS',  '2305', 'Discrete Mathematics',           'seed'),
  (3, 'CS',   'ECS',  '3345', 'Data Structures and Algorithms', 'seed'),
  (4, 'CS',   'ECS',  '3354', 'Software Engineering',           'seed'),
  (5, 'CS',   'ECS',  '4348', 'Operating Systems Concepts',     'seed'),
  (6, 'CS',   'ECS',  '4485', 'Computer Science Project',       'seed'),
  (7, 'CS',   'ECS',  '6360', 'Database Design',                'seed'),
  (8, 'EPPS', 'EPPS', '4310', 'Policy Research Methods',        'seed');  -- synthetic EPPS course

INSERT INTO course_sections (id, course_id, term_id, section_number, teacher_id, meeting_days, source) VALUES
  ( 1, 3,  4, '001',  1, 'MW', 'seed'),  -- CS 3345  Fall 2024    Prof A
  ( 2, 5,  4, '001',  1, 'TR', 'seed'),  -- CS 4348  Fall 2024    Prof A
  ( 3, 6,  5, '001',  2, 'F',  'seed'),  -- CS 4485  Spring 2025  Prof B
  ( 4, 1,  5, '001',  8, 'MW', 'seed'),  -- CS 1337  Spring 2025  Prof H
  ( 5, 5,  2, '001',  7, 'TR', 'seed'),  -- CS 4348  Spring 2024  Prof G    (outside 2-yr window)
  ( 6, 2,  4, '001',  7, 'MW', 'seed'),  -- CS 2305  Fall 2024    Prof G
  ( 7, 4,  7, '001',  4, 'TR', 'seed'),  -- CS 3354  Fall 2025    Prof D
  ( 8, 5,  7, '001',  4, 'MW', 'seed'),  -- CS 4348  Fall 2025    Prof D
  ( 9, 6,  7, '001',  6, 'F',  'seed'),  -- CS 4485  Fall 2025    Prof F
  (10, 3,  7, '001',  8, 'TR', 'seed'),  -- CS 3345  Fall 2025    Prof H
  (11, 7,  7, '001',  2, 'W',  'seed'),  -- CS 6360  Fall 2025    Prof B
  (12, 1,  7, '001',  3, 'MW', 'seed'),  -- CS 1337  Fall 2025    Prof C
  (13, 8,  7, '001',  9, 'TR', 'seed'),  -- EPPS 4310 Fall 2025    Prof I
  (14, 3,  8, '001',  6, 'MW', 'seed'),  -- CS 3345  Spring 2026  Prof F
  (15, 4,  8, '001',  7, 'TR', 'seed'),  -- CS 3354  Spring 2026  Prof G
  (16, 6,  8, '001',  2, 'F',  'seed'),  -- CS 4485  Spring 2026  Prof B
  (17, 2,  8, '001',  3, 'MW', 'seed'),  -- CS 2305  Spring 2026  Prof C
  (18, 8,  8, '001', 10, 'TR', 'seed'),  -- EPPS 4310 Spring 2026  Prof J
  (19, 4, 10, '001',  2, 'MW', 'seed'),  -- CS 3354  Fall 2026    Prof B
  (20, 4, 10, '002',  5, 'TR', 'seed'),  -- CS 3354  Fall 2026    Prof E
  (21, 1, 10, '001',  3, 'MW', 'seed'),  -- CS 1337  Fall 2026    Prof C
  (22, 6, 10, '001',  6, 'F',  'seed');  -- CS 4485  Fall 2026    Prof F

-- Keep identity sequences ahead of the explicit ids inserted above.
SELECT setval(pg_get_serial_sequence('terms',           'id'), (SELECT max(id) FROM terms));
SELECT setval(pg_get_serial_sequence('teachers',        'id'), (SELECT max(id) FROM teachers));
SELECT setval(pg_get_serial_sequence('courses',         'id'), (SELECT max(id) FROM courses));
SELECT setval(pg_get_serial_sequence('course_sections', 'id'), (SELECT max(id) FROM course_sections));
