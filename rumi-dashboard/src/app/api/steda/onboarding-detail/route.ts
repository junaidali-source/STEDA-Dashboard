import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData, type SteadaTeacher } from '@/lib/steda-phones'
import { getDistrictLatLng, normalizeStedaDistrict } from '@/lib/steda-district-geo'

export const dynamic = 'force-dynamic'

function dedupeTeachers(list: SteadaTeacher[]): SteadaTeacher[] {
  const m = new Map<string, SteadaTeacher>()
  for (const t of list) {
    if (!m.has(t.phone)) m.set(t.phone, t)
  }
  return [...m.values()]
}

function titleDistrictLabel(key: string): string {
  if (!key) return 'Unknown'
  return key
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export async function GET() {
  try {
    const { teachers: rawTeachers } = getSteadaData()
    const teachers = dedupeTeachers(rawTeachers)
    const phones = teachers.map((t) => t.phone)
    if (phones.length === 0) {
      return NextResponse.json({
        totalListed: 0,
        totalJoined: 0,
        totalEngaged: 0,
        notYet: 0,
        onboardedPct: 0,
        engagementPct: 0,
        districts: [] as unknown[],
        teachers: [] as unknown[],
      })
    }

    const joinedRes = await pool.query(
      `SELECT id::uuid AS id, phone_number::text AS phone FROM users
       WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user, false) = false`,
      [phones]
    )
    const joinedPhones = new Set<string>(joinedRes.rows.map((r: { phone: string }) => r.phone))
    const phoneToUserId = new Map<string, string>(
      joinedRes.rows.map((r: { id: string; phone: string }) => [r.phone, r.id])
    )
    const joinedUserIds: string[] = joinedRes.rows.map((r: { id: string }) => r.id)

    let engagedUserIds = new Set<string>()
    if (joinedUserIds.length > 0) {
      const engRes = await pool.query(
        `SELECT DISTINCT user_id::text AS id FROM (
           SELECT user_id FROM lesson_plan_requests    WHERE user_id = ANY($1::uuid[])
           UNION
           SELECT user_id FROM coaching_sessions       WHERE user_id = ANY($1::uuid[])
           UNION
           SELECT user_id FROM reading_assessments     WHERE user_id = ANY($1::uuid[])
           UNION
           SELECT user_id FROM video_requests          WHERE user_id = ANY($1::uuid[])
           UNION
           SELECT user_id FROM image_analysis_requests WHERE user_id = ANY($1::uuid[])
         ) sub`,
        [joinedUserIds]
      )
      engagedUserIds = new Set(engRes.rows.map((r: { id: string }) => r.id))
    }

    type Agg = { listed: number; joined: number; engaged: number; label: string }
    const byDistrict = new Map<string, Agg>()
    for (const t of teachers) {
      const key = normalizeStedaDistrict(t.district) || 'Unknown'
      let cur = byDistrict.get(key)
      if (!cur) {
        const raw = (t.district || '').trim()
        cur = { listed: 0, joined: 0, engaged: 0, label: raw || titleDistrictLabel(key) }
        byDistrict.set(key, cur)
      }
      cur.listed += 1
      if (joinedPhones.has(t.phone)) {
        cur.joined += 1
        const uid = phoneToUserId.get(t.phone)
        if (uid && engagedUserIds.has(uid)) cur.engaged += 1
      }
    }

    const districts = [...byDistrict.entries()].map(([districtKey, a]) => {
      const [lat, lng] = getDistrictLatLng(districtKey === 'Unknown' ? '' : districtKey)
      const onboardedPct = a.listed > 0 ? Math.round((a.joined / a.listed) * 100) : 0
      const engagementPct = a.joined > 0 ? Math.round((a.engaged / a.joined) * 100) : 0
      return {
        districtKey,
        label: a.label,
        listed: a.listed,
        joined: a.joined,
        engaged: a.engaged,
        onboardedPct,
        engagementPct,
        lat,
        lng,
      }
    })
    districts.sort((x, y) => y.listed - x.listed)

    const totalListed = teachers.length
    const totalJoined = teachers.filter((t) => joinedPhones.has(t.phone)).length
    const totalEngaged = teachers.filter((t) => {
      if (!joinedPhones.has(t.phone)) return false
      const uid = phoneToUserId.get(t.phone)
      return uid ? engagedUserIds.has(uid) : false
    }).length
    const onboardedPct = totalListed > 0 ? Math.round((totalJoined / totalListed) * 100) : 0
    const engagementPct = totalJoined > 0 ? Math.round((totalEngaged / totalJoined) * 100) : 0

    const teacherRows = teachers.map((t) => ({
      phone: t.phone,
      name: t.name || '—',
      school: t.school || '—',
      district: t.district || '—',
      designation: t.designation || '—',
      gender: t.gender || '—',
      schoolType: t.schoolType || '—',
      onboarded: joinedPhones.has(t.phone),
    }))
    teacherRows.sort((a, b) => {
      if (a.onboarded !== b.onboarded) return a.onboarded ? 1 : -1
      return (a.district || '').localeCompare(b.district || '')
    })

    return NextResponse.json({
      totalListed,
      totalJoined,
      totalEngaged,
      notYet: totalListed - totalJoined,
      onboardedPct,
      engagementPct,
      districts,
      teachers: teacherRows,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
