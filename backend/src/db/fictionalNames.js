// Fictional first and last names for imported instructors (#101; 10/21
// review: realistic names, not "Professor XYZ"). A name is picked from a hash
// of the Nebula professor id, so re-running the import gives the same person
// the same name. These are common names chosen by hand, not taken from any
// source of real people; real instructor names are never fetched or stored.

export const FIRST_NAMES = [
  'Maria', 'David', 'Aisha', 'James', 'Sofia', 'Michael', 'Elena', 'Daniel',
  'Grace', 'Omar', 'Hannah', 'Samuel', 'Leila', 'Thomas', 'Mei', 'Andre',
  'Rachel', 'Victor', 'Nadia', 'Kevin', 'Laura', 'Ibrahim', 'Julia', 'Marcus',
  'Ana', 'Ethan', 'Fatima', 'Lucas', 'Claire', 'Rohan', 'Isabel', 'Noah',
  'Yara', 'Gabriel', 'Chloe', 'Tariq', 'Emma', 'Diego', 'Naomi', 'Felix',
  'Ines', 'Arjun', 'Lena', 'Mateo', 'Sara', 'Jonah', 'Amara', 'Caleb',
  'Lucia', 'Hassan', 'Megan', 'Ravi', 'Olivia', 'Tomas', 'Zara', 'Henry',
  'Keiko', 'Adrian', 'Ruth', 'Kofi', 'Alice', 'Mohan', 'Vera', 'Owen',
];

export const LAST_NAMES = [
  'Chen', 'Okafor', 'Rahman', 'Whitfield', 'Alvarez', 'Tran', 'Petrova', 'Brooks',
  'Kim', 'Haddad', 'Novak', 'Mensah', 'Castillo', 'Lindqvist', 'Nakamura', 'Duarte',
  'Ferreira', 'Ivanova', 'Osei', 'Morales', 'Kowalski', 'Sato', 'Bianchi', 'Adeyemi',
  'Larsen', 'Moreau', 'Vasquez', 'Holloway', 'Iyer', 'Schultz', 'Delgado', 'Park',
  'Abbott', 'Navarro', 'Ellison', 'Farouk', 'Gallagher', 'Hoang', 'Jaramillo', 'Keller',
  'Lambert', 'Mbeki', 'Nilsson', 'Ortega', 'Pham', 'Quinn', 'Rossi', 'Sandoval',
  'Thornton', 'Ueda', 'Valdez', 'Weber', 'Yilmaz', 'Zhou', 'Barros', 'Coleman',
  'Dimitrov', 'Escobar', 'Fischer', 'Greer', 'Hartmann', 'Ishikawa', 'Jensen', 'Kapoor',
];

export const NAME_COMBINATIONS = FIRST_NAMES.length * LAST_NAMES.length;

// `hash` is a hex digest. Every first + last pair is numbered 0..4095; the
// hash picks the starting number and `attempt` steps forward from it when a
// name is already taken, so retries reach every combination before repeating.
export function fictionalName(hash, attempt = 0) {
  const k = (parseInt(hash.slice(0, 8), 16) + attempt) % NAME_COMBINATIONS;
  return {
    firstName: FIRST_NAMES[Math.floor(k / LAST_NAMES.length)],
    lastName: LAST_NAMES[k % LAST_NAMES.length],
  };
}
