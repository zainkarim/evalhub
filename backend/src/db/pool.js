import pg from 'pg';
import { config } from '../config.js';

// node-postgres turns DATE columns into JS Date objects in the *server's* local
// timezone, which causes off-by-one-day bugs. Keep them as 'YYYY-MM-DD' strings.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

export const query = (text, params) => pool.query(text, params);
