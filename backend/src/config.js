function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name} (copy .env.example to .env)`);
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  // Set DATABASE_SSL=true for managed Postgres that requires TLS.
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  // Comma-separated list of allowed browser origins (the Vite dev server by default)
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  // Set TRUST_PROXY=true when running behind nginx / a PaaS proxy so rate limiting sees real client IPs
  trustProxy: process.env.TRUST_PROXY === 'true',
};

if (config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
}
