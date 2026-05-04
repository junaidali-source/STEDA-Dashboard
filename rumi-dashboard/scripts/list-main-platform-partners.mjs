import pg from 'pg'

const url = process.env.ANALYST_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Set ANALYST_DATABASE_URL (postgresql://...)')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

const summary = await client.query(`
  SELECT
    school_name,
    COUNT(*)::int AS users
  FROM users
  WHERE COALESCE(is_test_user, false) = false
    AND school_name IS NOT NULL
    AND TRIM(school_name) <> ''
  GROUP BY school_name
  ORDER BY users DESC, school_name ASC
  LIMIT 120
`)

const hinted = await client.query(`
  SELECT
    school_name,
    COUNT(*)::int AS users
  FROM users
  WHERE COALESCE(is_test_user, false) = false
    AND school_name IS NOT NULL
    AND TRIM(school_name) <> ''
    AND (
      school_name ILIKE '%shofco%'
      OR school_name ILIKE '%taleemabad%'
      OR school_name ILIKE '%tcf%'
      OR school_name ILIKE '%teachfirst%'
      OR school_name ILIKE '%aps%'
    )
  GROUP BY school_name
  ORDER BY users DESC, school_name ASC
`)

await client.end()

console.log(JSON.stringify({ top_school_entities: summary.rows, hinted_entities: hinted.rows }, null, 2))
