import pg from 'pg'

const url = process.env.ANALYST_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Set ANALYST_DATABASE_URL')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

const cols = await client.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      column_name ILIKE '%org%'
      OR column_name ILIKE '%organization%'
      OR column_name ILIKE '%school%'
      OR column_name ILIKE '%institution%'
    )
  ORDER BY table_name, ordinal_position
`)

const reg = await client.query(`
  SELECT registration_state, COUNT(*)::int AS n
  FROM users
  WHERE COALESCE(is_test_user, false) = false
  GROUP BY registration_state
  ORDER BY n DESC
`)

const topSchool = await client.query(`
  SELECT school_name, COUNT(*)::int AS users
  FROM users
  WHERE COALESCE(is_test_user, false) = false
    AND school_name IS NOT NULL
    AND TRIM(school_name) <> ''
  GROUP BY school_name
  ORDER BY users DESC
  LIMIT 30
`)

const topOrganization = await client.query(`
  SELECT organization, COUNT(*)::int AS users
  FROM users
  WHERE COALESCE(is_test_user, false) = false
    AND organization IS NOT NULL
    AND TRIM(organization) <> ''
  GROUP BY organization
  ORDER BY users DESC
  LIMIT 120
`)

await client.end()
console.log(JSON.stringify({
  columns: cols.rows,
  registration_states: reg.rows,
  top_school_names: topSchool.rows,
  top_organization_values: topOrganization.rows,
}, null, 2))
