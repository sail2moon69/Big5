// PostgreSQL access for the course management (Lehrgangsverwaltung).
// Connection settings come from the standard libpq variables PGHOST, PGPORT, PGUSER,
// PGPASSWORD and PGDATABASE, which the pg driver reads by itself.
const { Pool, types } = require('pg')

// DATE columns as plain 'YYYY-MM-DD' strings instead of local-midnight Date objects
types.setTypeParser(1082, value => value)

let pool = null

function getPool () {
  if (!pool) {
    pool = new Pool({ max: 5, idleTimeoutMillis: 30000 })
    pool.on('error', error => console.error('postgres pool error:', error.message))
  }
  return pool
}

function query (text, params) {
  return getPool().query(text, params)
}

async function withTransaction (work) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

// Each entry runs once, in order; the applied version is kept in schema_version.
// Never edit an entry that has shipped - add a new one.
const MIGRATIONS = [
  `
  CREATE TABLE trainers (
    id serial PRIMARY KEY,
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'trainer')),
    disabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    trainer_id integer NOT NULL REFERENCES trainers (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  );

  CREATE TABLE courses (
    id serial PRIMARY KEY,
    trainer_id integer NOT NULL REFERENCES trainers (id) ON DELETE RESTRICT,
    name text NOT NULL,
    starts_on date,
    ends_on date NOT NULL,
    brand text NOT NULL DEFAULT 'rdsim',
    language text NOT NULL DEFAULT 'de',
    retention_days integer NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 365),
    show_result boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE participants (
    id serial PRIMARY KEY,
    course_id integer NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    name text NOT NULL,
    email text,
    token_hash text NOT NULL UNIQUE,
    token_enc text NOT NULL,
    invited_at timestamptz,
    consent_at timestamptz,
    consent_version text,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX participants_course_idx ON participants (course_id);

  CREATE TABLE results (
    participant_id integer PRIMARY KEY REFERENCES participants (id) ON DELETE CASCADE,
    payload_enc text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  -- ids only, no names: the log outlives the deleted courses it refers to
  CREATE TABLE audit_log (
    id bigserial PRIMARY KEY,
    at timestamptz NOT NULL DEFAULT now(),
    trainer_id integer,
    action text NOT NULL,
    course_id integer,
    participant_id integer
  );
  `
]

async function migrate () {
  await query('CREATE TABLE IF NOT EXISTS schema_version (version integer NOT NULL)')
  await withTransaction(async client => {
    // one migrating process at a time
    await client.query('LOCK TABLE schema_version IN EXCLUSIVE MODE')
    const { rows } = await client.query('SELECT max(version) AS version FROM schema_version')
    const current = rows[0].version || 0
    for (let index = current; index < MIGRATIONS.length; index++) {
      await client.query(MIGRATIONS[index])
      await client.query('INSERT INTO schema_version (version) VALUES ($1)', [index + 1])
      console.log(`database migrated to version ${index + 1}`)
    }
  })
}

async function close () {
  if (pool) {
    await pool.end()
    pool = null
  }
}

module.exports = { query, withTransaction, migrate, close }
