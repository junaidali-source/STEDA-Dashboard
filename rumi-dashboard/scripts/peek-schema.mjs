import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
const raw = fs.readFileSync(envPath, 'utf8')
for (const line of raw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

const p = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 6543),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
})

const q = async (sql, params = []) => (await p.query(sql, params)).rows

try {
  console.log('--- dashboard_users columns ---')
  console.log(await q(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dashboard_users' ORDER BY ordinal_position`))
  console.log('--- access_scopes columns ---')
  console.log(await q(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='access_scopes' ORDER BY ordinal_position`))
  console.log('--- sample dashboard_users (partner roles) ---')
  console.log(await q(`SELECT id, email, role FROM dashboard_users
    WHERE LOWER(role) LIKE 'partner%' OR LOWER(role) IN ('partner','partner_admin','partner_viewer')
    LIMIT 15`))
  console.log('--- sample scope_value keys ---')
  const rows = await q(`SELECT scope_type, jsonb_object_keys(scope_value) AS k FROM access_scopes WHERE scope_value IS NOT NULL LIMIT 20`)
  console.log(rows)
  console.log('--- tables matching org ---')
  console.log(await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%org%' ORDER BY 1`))
  const orgCols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='portal_organizations' ORDER BY ordinal_position`)
  if (orgCols.length) {
    console.log('--- portal_organizations columns ---')
    console.log(orgCols)
    console.log('--- sample portal_organizations ---')
    console.log(await q(`SELECT * FROM portal_organizations LIMIT 15`))
  }
  console.log('--- columns named region/province ---')
  console.log(await q(`SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema='public' AND (column_name ILIKE '%region%' OR column_name ILIKE '%province%' OR column_name ILIKE '%state%')
    ORDER BY 1,2`))
  console.log('--- access_scopes scope_value sample (full json) phone_list ---')
  console.log(await q(`SELECT scope_type, scope_value FROM access_scopes WHERE scope_type='phone_list' LIMIT 3`))
  console.log('--- distinct users.region (pk phones) ---')
  console.log(await q(`SELECT region, COUNT(*)::int AS n FROM users WHERE LEFT(phone_number,2)='92' AND COALESCE(is_test_user,false)=false GROUP BY region ORDER BY n DESC NULLS LAST LIMIT 30`))
} catch (e) {
  console.error(e)
} finally {
  await p.end()
}
