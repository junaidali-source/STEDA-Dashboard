export interface CohortSummary {
  total_users: number
  registered: number
  unregistered: number
  reg_rate: number
  sent_1_plus: number
  sent_10_plus: number
  reg_avg_messages: number
  reg_avg_days: number
  reg_lp_pct: number
  reg_cs_pct: number
  reg_ra_pct: number
  unreg_avg_messages: number
  unreg_avg_days: number
  unreg_lp_pct: number
  unreg_cs_pct: number
  unreg_ra_pct: number
}

export interface MessageBucket {
  bucket: string
  count: number
  registered: number
}

export interface CountryRow {
  cc: string
  label: string
  total: number
  registered: number
}

export interface CohortData {
  week_start: string
  week_label: string
  summary: CohortSummary
  message_buckets: MessageBucket[]
  countries: CountryRow[]
}
