import { NextResponse } from 'next/server'
import { pool, organizationKeySql } from '@/lib/db'

export const dynamic = 'force-dynamic'

function partnerLabel(key: string): string {
  switch (key) {
    case 'tcf': return 'TCF'
    case 'shofco': return 'SHOFCO'
    case 'taleemabad': return 'Taleemabad'
    case 'aps_askari_14': return 'Apsaskari 14'
    case 'aga_khan': return 'Aga Khan'
    case 'british_council': return 'British Council'
    case 'sed_punjab': return 'SED Punjab'
    case 'steda': return 'STEDA'
    case 'seld': return 'SELD'
    case 'rdf': return 'RDF'
    default:
      return key
        .split('_')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
  }
}

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        org_key AS id,
        COUNT(*)::int AS teacher_count,
        COUNT(*) FILTER (WHERE LEFT(u.phone_number, 2) = '92')::int AS pk_teacher_count,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT
          CASE
            WHEN LEFT(u.phone_number, 2) <> '92' THEN NULL
            WHEN LOWER(TRIM(COALESCE(u.region::text, ''))) = 'federal' THEN 'islamabad'
            WHEN u.region IS NULL OR TRIM(COALESCE(u.region::text, '')) = '' THEN '__unspecified__'
            ELSE LOWER(TRIM(u.region::text))
          END
        ), NULL) AS pk_region_slugs
      FROM (
        SELECT u.*, ${organizationKeySql('u')} AS org_key
        FROM users u
        WHERE COALESCE(u.is_test_user, false) = false
      ) u
      WHERE org_key <> ''
      GROUP BY org_key
      ORDER BY COUNT(*) DESC, org_key ASC
    `)

    const partners = rows.map((r) => {
      const pkCnt = Number(r.pk_teacher_count) || 0
      let slugs = (r.pk_region_slugs as string[]) || []
      if (pkCnt > 0 && slugs.length === 0) slugs = ['__unspecified__']
      return {
        id: r.id as string,
        name: partnerLabel(r.id as string),
        domain: '',
        teacher_count: Number(r.teacher_count) || 0,
        pk_teacher_count: pkCnt,
        pk_region_slugs: slugs,
      }
    })

    return NextResponse.json(partners)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
