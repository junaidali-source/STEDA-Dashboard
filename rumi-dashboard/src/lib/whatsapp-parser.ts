import fs   from 'fs'
import path from 'path'
import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────────────────────────
export type Sentiment = 'positive' | 'question' | 'issue' | 'other'

export interface WaMessage {
  timestamp: string
  date:      string
  sender:    string
  text:      string
  sentiment: Sentiment
  source?:   'file' | 'live'
}

export interface DailyActivity {
  date:  string
  count: number
}

export interface SentimentResult {
  totalMessages:  number
  positive:       number
  questions:      number
  issues:         number
  other:          number
  totalCommunity: number
  lastUpdated:    string
  liveConnected:  boolean
  recentMessages: Array<{ sender: string; text: string; sentiment: Sentiment; date: string }>
  dailyActivity:  DailyActivity[]
  praiseQuotes:   Array<{ speaker: string; text: string }>
  issueQuotes:    Array<{ speaker: string; text: string }>
  segments:       Array<{ name: string; value: number; color: string }>
}

// ── File paths (local dev only) ───────────────────────────────────────────────
const CHAT_PATH   = path.join(process.cwd(), '..', 'WhatsApp Chat with General  Discussions.txt')
const LIVE_PATH   = path.join(process.cwd(), '..', 'wa-messages.json')
const STATUS_PATH = path.join(process.cwd(), '..', 'wa-status.json')

const NARROW_NBSP = '\u202F'
const MSG_PAT = new RegExp(
  `^(\\d+/\\d+/\\d+,\\s[\\d:]+${NARROW_NBSP}[AP]M)\\s-\\s([^:]+):\\s(.+)`,
  'u'
)

const ADMINS = new Set([
  'Sajid Hussain Mallah', 'Junaid Ali', 'You',
  'Afzal ahmed', 'GUL HASSAN', 'Ayaz Iqbal Jokhio',
])

const POS_KW = [
  'great','amazing','wonderful','thrilled','fantastic','mind','superb','awesome',
  'useful','helpful','thank','hats off','proud','initiative','glad','love',
]
const ISS_KW = [
  'problem','issue','glitch','not work','error','slow','not receiv','nahi',
  'cannot',"can't",'waiting','never get',
]
const Q_KW = ['how','what','where','kaise','kia','kya']

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cache: { result: SentimentResult; key: string; ts: number } | null = null
const CACHE_TTL = 30 * 1000  // 30s — picks up new live messages quickly

function classifySentiment(text: string): Sentiment {
  const lower = text.toLowerCase()
  if (POS_KW.some(k => lower.includes(k)))                          return 'positive'
  if (ISS_KW.some(k => lower.includes(k)))                          return 'issue'
  if (text.includes('?') || Q_KW.some(k => lower.includes(k)))     return 'question'
  return 'other'
}

function parseDate(raw: string): string {
  const [month, day, yr] = raw.split('/').map(Number)
  const year = yr < 100 ? 2000 + yr : yr
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

// ── DB: load live messages from Supabase whatsapp_messages table ──────────────
async function loadDbMessages(): Promise<{ messages: WaMessage[]; liveConnected: boolean }> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('timestamp, date, sender, text, sentiment, created_at')
      .order('timestamp', { ascending: true })
      .limit(2000)

    if (error) throw error

    const messages: WaMessage[] = (data ?? []).map(r => ({
      timestamp: r.timestamp,
      date:      r.date,
      sender:    r.sender,
      text:      r.text,
      sentiment: r.sentiment as Sentiment,
      source:    'live' as const,
    }))

    // Live = any message inserted in the last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', fiveMinAgo)

    return { messages, liveConnected: (count ?? 0) > 0 }
  } catch {
    return { messages: [], liveConnected: false }
  }
}

// ── Local file helpers (used when running locally without Vercel) ─────────────
function getLocalLiveStatus(): boolean {
  try {
    const s = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf-8'))
    return s.status === 'connected' && (Date.now() - new Date(s.updatedAt).getTime()) < 2 * 60 * 1000
  } catch { return false }
}

function loadLocalLiveMessages(): WaMessage[] {
  try {
    const raw = JSON.parse(fs.readFileSync(LIVE_PATH, 'utf-8')) as Array<Record<string, string>>
    return raw.map(r => ({
      timestamp: r.timestamp, date: r.date, sender: r.sender,
      text: r.text, sentiment: r.sentiment as Sentiment, source: 'live' as const,
    }))
  } catch { return [] }
}

// ── Parse the WhatsApp .txt export ────────────────────────────────────────────
function parseTextExport(): { messages: WaMessage[]; joinNames: Set<string>; mtime: number } {
  let mtime = 0
  try { mtime = fs.statSync(CHAT_PATH).mtimeMs } catch { /* not found on Vercel */ }

  const messages: WaMessage[] = []
  const joinNames = new Set<string>()

  let content = ''
  try { content = fs.readFileSync(CHAT_PATH, 'utf-8').replace(/^\uFEFF/, '') }
  catch { return { messages, joinNames, mtime } }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (line.includes('joined from the community')) {
      const m = line.match(/^\d+\/\d+\/\d+,\s[\d:]+[\s\u202f][AP]M\s-\s(.+?)\s+joined/)
      if (m) joinNames.add(m[1].trim())
    }
    const m = MSG_PAT.exec(line)
    if (!m) continue
    const [, tsRaw, senderRaw, text] = m
    const sender = senderRaw.trim()
    if (ADMINS.has(sender)) continue
    if (text.includes('<Media') || text.includes('omitted')) continue
    if (text.length <= 5) continue
    messages.push({
      timestamp: tsRaw,
      date:      parseDate(tsRaw.split(',')[0].trim()),
      sender, text,
      sentiment: classifySentiment(text),
      source:    'file',
    })
  }
  return { messages, joinNames, mtime }
}

// ── Assemble final result ─────────────────────────────────────────────────────
function buildResult(
  allMessages: WaMessage[],
  joinNames:   Set<string>,
  lastUpdated: string,
  liveConnected: boolean,
): SentimentResult {
  const dailyMap = new Map<string, number>()
  for (const m of allMessages) dailyMap.set(m.date, (dailyMap.get(m.date) ?? 0) + 1)

  const pos = allMessages.filter(m => m.sentiment === 'positive').length
  const iss = allMessages.filter(m => m.sentiment === 'issue').length
  const qs  = allMessages.filter(m => m.sentiment === 'question').length
  const oth = allMessages.filter(m => m.sentiment === 'other').length

  const praiseQuotes = allMessages
    .filter(m => m.sentiment === 'positive')
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, 4)
    .map(m => ({ speaker: m.sender.split(' ')[0], text: m.text }))

  const issueQuotes = allMessages
    .filter(m => m.sentiment === 'issue')
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, 3)
    .map(m => ({ speaker: m.sender.split(' ')[0], text: m.text }))

  const recentMessages = allMessages
    .slice(-10).reverse()
    .map(m => ({
      sender:    m.sender.split(' ')[0],
      text:      m.text.length > 120 ? m.text.slice(0, 120) + '…' : m.text,
      sentiment: m.sentiment,
      date:      m.date,
    }))

  const dailyActivity: DailyActivity[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  return {
    totalMessages: allMessages.length,
    positive: pos, questions: qs, issues: iss, other: oth,
    totalCommunity: joinNames.size,
    lastUpdated, liveConnected,
    recentMessages, dailyActivity, praiseQuotes, issueQuotes,
    segments: [
      { name: 'Positive',  value: pos, color: '#22C55E' },
      { name: 'Questions', value: qs,  color: '#3B82F6' },
      { name: 'Issues',    value: iss, color: '#EF4444' },
      { name: 'Other',     value: oth, color: '#64748B' },
    ],
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function parseWhatsAppChat(): Promise<SentimentResult> {
  const isVercel = !!process.env.VERCEL

  let fileMtime = 0
  try { fileMtime = fs.statSync(CHAT_PATH).mtimeMs } catch {}
  const cacheKey = `${fileMtime}-${Date.now() - (Date.now() % CACHE_TTL)}`

  if (_cache && _cache.key === cacheKey) return _cache.result

  // Parse .txt export (empty on Vercel — graceful)
  const { messages: fileMessages, joinNames, mtime } = parseTextExport()

  // Load from DB (works on Vercel + local)
  const { messages: dbMessages, liveConnected: dbLive } = await loadDbMessages()

  // Load local JSON only when not on Vercel
  const localMessages = isVercel ? [] : loadLocalLiveMessages()
  const localLive     = isVercel ? false : getLocalLiveStatus()

  // Merge all sources, deduplicate by sender|date|text prefix
  const seen = new Set(fileMessages.map(m => `${m.sender}|${m.date}|${m.text.slice(0, 40)}`))
  const allMessages: WaMessage[] = [...fileMessages]

  const addIfNew = (m: WaMessage) => {
    const key = `${m.sender}|${m.date}|${m.text.slice(0, 40)}`
    if (!seen.has(key)) { seen.add(key); allMessages.push(m) }
  }
  for (const m of dbMessages)    addIfNew(m)
  for (const m of localMessages) addIfNew(m)

  allMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  const dbTimes   = dbMessages.map(m => new Date(m.timestamp).getTime()).filter(Boolean)
  const latestDb  = dbTimes.length ? Math.max(...dbTimes) : 0
  const lastUpdated = new Date(Math.max(latestDb, mtime || 0) || Date.now()).toISOString()

  const result = buildResult(allMessages, joinNames, lastUpdated, dbLive || localLive)
  _cache = { result, key: cacheKey, ts: Date.now() }
  return result
}
