import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page:        { padding: 48, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, borderBottom: '1pt solid #E5E7EB', paddingBottom: 12 },
  title:       { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1F4E79' },
  sub:         { fontSize: 9, color: '#6B7280', marginTop: 3 },
  section:     { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1F4E79', marginBottom: 8, marginTop: 16 },
  kpiRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiCard:     { flex: 1, backgroundColor: '#F8FAFC', border: '1pt solid #E5E7EB', borderRadius: 6, padding: 10 },
  kpiVal:      { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#111827' },
  kpiLabel:    { fontSize: 8, color: '#6B7280', marginTop: 2 },
  kpiSub:      { fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  thRow:       { flexDirection: 'row', backgroundColor: '#1F4E79', padding: '5 8' },
  th:          { fontSize: 8, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  tr:          { flexDirection: 'row', padding: '4 8', borderBottom: '0.5pt solid #E5E7EB' },
  trAlt:       { backgroundColor: '#F9FAFB' },
  td:          { fontSize: 8, color: '#374151' },
  green:       { color: '#059669' },
  amber:       { color: '#D97706' },
  red:         { color: '#DC2626' },
  footer:      { position: 'absolute', bottom: 32, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:  { fontSize: 8, color: '#9CA3AF' },
})

function ragColor(status: string) {
  if (status === 'done' || status === 'green') return s.green
  if (status === 'at_risk' || status === 'red') return s.red
  return s.amber
}

interface Snapshot {
  snapshot_date: string
  teachers_listed: number; teachers_joined: number; joined_pct: number
  used_any_feature: number; used_any_pct: number
  total_requests: number; completion_pct: number
  lp_teachers: number; lp_requests: number; lp_completion: number
  coaching_teachers: number; video_teachers: number; video_completion: number
}
interface Milestone { title: string; end_date: string; status: string; success_metric: string; actual_result: string }
interface Action    { text: string; owner: string; due_date: string; priority: string; status: string }

interface Props { snapshot: Snapshot | null; milestones: Milestone[]; actions: Action[]; generatedDate: string }

export function TrackerReport({ snapshot, milestones, actions, generatedDate }: Props) {
  const sn = snapshot
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>STEDA × Rumi — Deployment Tracker</Text>
            <Text style={s.sub}>AI-Powered Teaching Pilot · Sindh Province, Pakistan</Text>
            <Text style={s.sub}>Generated: {generatedDate}</Text>
          </View>
          <View><Text style={[s.sub, { textAlign: 'right' }]}>Taleemabad · CONFIDENTIAL</Text></View>
        </View>

        <Text style={s.section}>Deployment KPIs</Text>
        {sn ? (
          <View style={s.kpiRow}>
            {[
              { label: 'Teachers Joined',  value: `${sn.teachers_joined}`,     sub: `${sn.joined_pct}% of ${sn.teachers_listed} listed`, status: sn.joined_pct >= 70 ? 'green' : sn.joined_pct >= 60 ? 'amber' : 'red' },
              { label: 'Used Any Feature', value: `${sn.used_any_feature}`,     sub: `${sn.used_any_pct}% of joined`, status: sn.used_any_pct >= 60 ? 'green' : 'amber' },
              { label: 'Total AI Requests',value: `${sn.total_requests || 0}`, sub: `${sn.completion_pct}% completion`, status: 'green' },
              { label: 'Coaching Teachers',value: `${sn.coaching_teachers}`,   sub: 'coaching feature', status: sn.coaching_teachers >= 50 ? 'green' : sn.coaching_teachers >= 10 ? 'amber' : 'red' },
            ].map((kpi, i) => (
              <View key={i} style={s.kpiCard}>
                <Text style={s.kpiVal}>{kpi.value}</Text>
                <Text style={s.kpiLabel}>{kpi.label}</Text>
                <Text style={[s.kpiSub, ragColor(kpi.status)]}>{kpi.sub}</Text>
              </View>
            ))}
          </View>
        ) : <Text style={[s.td, { marginBottom: 8 }]}>No snapshot data available.</Text>}

        <Text style={s.section}>Deployment Milestones</Text>
        <View>
          <View style={s.thRow}>
            {['Milestone', 'Due', 'Status', 'Result / Target'].map((h, i) => (
              <Text key={i} style={[s.th, { flex: [3,1,1,3][i] }]}>{h}</Text>
            ))}
          </View>
          {milestones.map((m, i) => (
            <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
              <Text style={[s.td, { flex: 3 }]}>{m.title}</Text>
              <Text style={[s.td, { flex: 1 }]}>{m.end_date}</Text>
              <Text style={[s.td, { flex: 1 }, ragColor(m.status)]}>{m.status.replace('_',' ')}</Text>
              <Text style={[s.td, { flex: 3 }]}>{m.actual_result || m.success_metric}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Taleemabad — Confidential</Text>
          <Text style={s.footerText}>{generatedDate} · Page 1</Text>
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.section}>Open Action Items</Text>
        <View>
          <View style={s.thRow}>
            {['Action', 'Owner', 'Due', 'Priority'].map((h, i) => (
              <Text key={i} style={[s.th, { flex: [5,1,1,1][i] }]}>{h}</Text>
            ))}
          </View>
          {actions.filter(a => a.status === 'open').map((a, i) => (
            <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
              <Text style={[s.td, { flex: 5 }]}>{a.text}</Text>
              <Text style={[s.td, { flex: 1 }]}>{a.owner}</Text>
              <Text style={[s.td, { flex: 1 }]}>{a.due_date || 'TBD'}</Text>
              <Text style={[s.td, { flex: 1 }, a.priority === 'high' ? s.red : a.priority === 'medium' ? s.amber : s.green]}>{a.priority}</Text>
            </View>
          ))}
        </View>
        <View style={s.footer}>
          <Text style={s.footerText}>Taleemabad — Confidential</Text>
          <Text style={s.footerText}>{generatedDate} · Page 2</Text>
        </View>
      </Page>
    </Document>
  )
}
