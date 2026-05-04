'use strict'
/**
 * Parse a WhatsApp .txt export and upsert to Supabase whatsapp_messages.
 * Handles both "Rumi onboarding / Feedback" and "Cohort - 1 (The Torch Bearers)" chats.
 *
 *   node parse-wa-txt.js
 */

require('dotenv').config({ path: '../.env' })
const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')
const crypto = require('crypto')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

const FILES = [
  {
    file: 'C:/Users/Hp/Downloads/Whatsapp group chats/WhatsApp Chat with Rumi onboarding  Feedback (2)/WhatsApp Chat with Rumi onboarding  Feedback.txt',
    grp:  'Rumi onboarding / Feedback',
    since: new Date('2026-03-09T00:00:00.000Z'),
  },
  {
    file: 'C:/Users/Hp/Downloads/Whatsapp group chats/WhatsApp Chat with Cohort - 1 (The Torch Bearers)/WhatsApp Chat with Cohort - 1 (The Torch Bearers).txt',
    grp:  'Cohort - 1 (The Torch Bearers)',
    since: new Date('2026-04-04T00:00:00.000Z'),
  },
]

const ADMINS = new Set([
  'Sajid Hussain Mallah', 'Junaid Ali', 'You',
  'Afzal ahmed', 'GUL HASSAN', 'Ayaz Iqbal Jokhio',
  'Azeem Sb - StEDA', 'Haroon Yasin',
  'Mazhar Shah - Steda Sheerazi - STEDA', 'Waqas Niete',
  'Ali Sipra Taleemabad', 'Zeest Manager',
])

const POS_KW = ['great','amazing','wonderful','thrilled','fantastic','mind','superb','awesome',
  'useful','helpful','thank','hats off','proud','initiative','glad','love','jazakallah','masha allah',
  'alhamdulillah','excellent','best','perfect','appreciate','good','nice','well done','bravo']
const ISS_KW = ['problem','issue','glitch','not work','error','slow','not receiv','nahi',
  'cannot',"can't",'waiting','never get','not open','nahi aa','nhi','issue','fail','crash']
const Q_KW  = ['how','what','where','kaise','kia','kya','please','plz','pls']

function classifySentiment(text) {
  const lower = text.toLowerCase()
  if (POS_KW.some(k => lower.includes(k))) return 'positive'
  if (ISS_KW.some(k => lower.includes(k)))  return 'issue'
  if (text.includes('?') || Q_KW.some(k => lower.includes(k))) return 'question'
  return 'other'
}

// WhatsApp export format: "M/D/YY, H:MM\u202FAM/PM - Sender: text"
const NARROW = '\u202F'
const MSG_RE = new RegExp(
  `^(\\d+/\\d+/\\d+),\\s([\\d:]+${NARROW}[AP]M)\\s-\\s([^:]+):\\s(.+)`,
)
const SYS_RE = new RegExp(
  `^(\\d+/\\d+/\\d+),\\s([\\d:]+${NARROW}[AP]M)\\s-\\s` +
  `(?:Messages and calls|You (?:created|added|changed|pinned|removed)|` +
  `[^:]+(?:joined|left|removed|requested to join|was added|were added))`
)

function parseTimestamp(dateStr, timeStr) {
  // dateStr: "3/11/26"  timeStr: "6:39\u202FPM"
  const [m, d, y] = dateStr.split('/').map(Number)
  const year = y < 100 ? 2000 + y : y
  const timePart = timeStr.replace(NARROW, ' ')  // narrow nbsp → regular space
  return new Date(`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')} ${timePart}`)
}

function parseTxt(filePath, grp, since) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split('\n')
  const messages = []
  let current = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (current) current.text += '\n'
      continue
    }

    // Check if this is a new message header
    const m = trimmed.match(MSG_RE)
    if (m) {
      if (current) messages.push(current)
      const [, dateStr, timeStr, sender, text] = m
      const ts = parseTimestamp(dateStr, timeStr)
      current = { dateStr, timeStr, sender: sender.trim(), text: text.trim(), ts }
    } else if (SYS_RE.test(trimmed)) {
      // System event — skip
      if (current) { messages.push(current); current = null }
    } else if (current) {
      // Continuation of previous message
      current.text += '\n' + trimmed
    }
  }
  if (current) messages.push(current)

  return messages
    .filter(msg => {
      if (isNaN(msg.ts.getTime()))        return false
      if (msg.ts < since)                  return false
      if (ADMINS.has(msg.sender))          return false
      const text = msg.text.trim()
      if (!text || text.length <= 2)       return false
      if (text.includes('<Media omitted>')) return false
      if (text === 'null')                 return false
      if (/^\+\d{10,}$/.test(msg.sender)) return false  // skip phone-number-only senders
      return true
    })
    .map(msg => {
      const text = msg.text.trim()
      const isoDate = msg.ts.toISOString()
      // Deterministic ID: hash of group+sender+timestamp to avoid duplicates
      const idRaw = `${grp}|${msg.sender}|${isoDate}|${text.slice(0, 40)}`
      const id = 'txt_' + crypto.createHash('sha1').update(idRaw).digest('hex').slice(0, 20)
      return {
        id,
        timestamp: isoDate,
        date:      isoDate.slice(0, 10),
        sender:    msg.sender,
        text,
        sentiment: classifySentiment(text),
        grp,
        source:    'txt',
      }
    })
}

async function upsertBatch(rows) {
  const { error } = await supabase
    .from('whatsapp_messages')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

async function main() {
  let grandTotal = 0

  for (const { file, grp, since } of FILES) {
    console.log(`\nParsing: "${grp}"`)
    const msgs = parseTxt(file, grp, since)
    console.log(`  Parsed ${msgs.length} non-admin messages from ${since.toISOString().slice(0,10)} onwards`)

    if (msgs.length === 0) continue

    const dates = msgs.map(m => m.date).sort()
    console.log(`  Date range: ${dates[0]} → ${dates[dates.length-1]}`)

    // Upsert in batches of 100
    let saved = 0
    for (let i = 0; i < msgs.length; i += 100) {
      const batch = msgs.slice(i, i + 100)
      await upsertBatch(batch)
      saved += batch.length
      process.stdout.write(`  Upserted ${saved}/${msgs.length}\r`)
    }
    console.log(`  ✓ Upserted ${saved} messages for "${grp}"`)
    grandTotal += saved
  }

  // Final count
  const { count } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })

  console.log(`\n✅  Done — ${grandTotal} rows upserted across both groups`)
  console.log(`📊  Total messages now in Supabase: ${count}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
