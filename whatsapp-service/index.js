'use strict'

/**
 * STEDA WhatsApp Live Listener
 * Writes messages to Supabase (whatsapp_messages table) so the Vercel-deployed
 * dashboard can read them. Also writes a local wa-messages.json as backup.
 *
 * First run: npm install && npm start — scan QR with your phone.
 * Session persists in .wwebjs_auth/ — subsequent runs reconnect automatically.
 */

require('dotenv').config({ path: '../.env' })
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode  = require('qrcode-terminal')
const { Pool } = require('pg')
const fs      = require('fs')
const path    = require('path')

// ── Config ──────────────────────────────────────────────────────────────────
const OUTPUT_FILE = path.join(__dirname, '..', 'wa-messages.json')
const STATUS_FILE = path.join(__dirname, '..', 'wa-status.json')

const TARGET_GROUPS = (process.env.WA_GROUP_NAME || 'general  discussions,rumi onboarding / feedback')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

const MAX_MESSAGES = 2000

const ADMINS = new Set([
  'Sajid Hussain Mallah', 'Junaid Ali', 'You',
  'Afzal ahmed', 'GUL HASSAN', 'Ayaz Iqbal Jokhio',
])

// ── Supabase DB pool ─────────────────────────────────────────────────────────
const db = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 30000,
})

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id          text PRIMARY KEY,
      timestamp   timestamptz NOT NULL,
      date        date NOT NULL,
      sender      text NOT NULL,
      text        text NOT NULL,
      sentiment   text NOT NULL,
      grp         text,
      source      text DEFAULT 'live',
      created_at  timestamptz DEFAULT now()
    )
  `)
  console.log('[db] whatsapp_messages table ready')
}

async function insertMessage(entry) {
  await db.query(
    `INSERT INTO whatsapp_messages (id, timestamp, date, sender, text, sentiment, grp, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [entry.id, entry.timestamp, entry.date, entry.sender, entry.text, entry.sentiment, entry.group, 'live']
  )
}

// ── Sentiment keywords ────────────────────────────────────────────────────────
const POS_KW = [
  'great','amazing','wonderful','thrilled','fantastic','mind','superb','awesome',
  'useful','helpful','thank','hats off','proud','initiative','glad','love',
]
const ISS_KW = [
  'problem','issue','glitch','not work','error','slow','not receiv','nahi',
  'cannot',"can't",'waiting','never get',
]
const Q_KW = ['how','what','where','kaise','kia','kya']

function classifySentiment(text) {
  const lower = text.toLowerCase()
  if (POS_KW.some(k => lower.includes(k))) return 'positive'
  if (ISS_KW.some(k => lower.includes(k))) return 'issue'
  if (text.includes('?') || Q_KW.some(k => lower.includes(k))) return 'question'
  return 'other'
}

// ── Local file helpers (backup) ───────────────────────────────────────────────
function loadMessages() {
  try {
    if (fs.existsSync(OUTPUT_FILE)) return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'))
  } catch {}
  return []
}

function saveMessages(messages) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(messages.slice(-MAX_MESSAGES), null, 2), 'utf-8')
}

function writeStatus(status, extra = {}) {
  const payload = { status, updatedAt: new Date().toISOString(), ...extra }
  fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), 'utf-8')
  console.log(`[status] ${status}`)
}

// ── WhatsApp client ───────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu',
    ],
  },
})

client.on('qr', (qr) => {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Scan this QR code with WhatsApp on your phone')
  console.log('  (Settings → Linked Devices → Link a Device)')
  console.log('══════════════════════════════════════════════\n')
  qrcode.generate(qr, { small: true })
  writeStatus('waiting_for_qr')
})

client.on('authenticated', () => {
  console.log('[auth] Authenticated — session saved.')
  writeStatus('authenticated')
})

client.on('auth_failure', (msg) => {
  console.error('[auth] Authentication failed:', msg)
  writeStatus('auth_failure', { error: msg })
})

client.on('ready', async () => {
  console.log('[ready] WhatsApp client is ready!')
  writeStatus('connected', { startedAt: new Date().toISOString() })
  try {
    const chats = await client.getChats()
    const groups = chats.filter(c => c.isGroup || c.isCommunity)
    console.log('\n[ready] Available groups/communities:')
    groups.forEach(g => console.log(`  • "${g.name}"`))
    console.log()
  } catch (e) {
    console.error('[ready] Could not list chats:', e.message)
  }
})

client.on('disconnected', (reason) => {
  console.log('[disconnected]', reason)
  writeStatus('disconnected', { reason })
})

const SAFE_TYPES = new Set(['chat', 'image', 'video', 'audio', 'document', 'sticker'])

client.on('message', async (msg) => {
  try {
    if (!SAFE_TYPES.has(msg.type)) return
    if (!msg.body) return

    let chat
    try { chat = await msg.getChat() } catch { return }
    if (!chat) return

    const chatName = chat.name ?? chat.id?.user ?? ''
    const lowerName = chatName.toLowerCase()
    if (!TARGET_GROUPS.some(g => lowerName.includes(g))) return

    const sender = msg._data?.notifyName ?? msg.author ?? 'Unknown'
    const text   = msg.body?.trim() ?? ''

    if (ADMINS.has(sender)) return
    if (!text || text.length <= 5) return
    if (text.includes('<Media') || text.includes('omitted')) return

    const ts        = msg.timestamp * 1000
    const isoDate   = new Date(ts).toISOString()
    const dateStr   = isoDate.slice(0, 10)
    const sentiment = classifySentiment(text)

    const entry = {
      id:        msg.id._serialized,
      timestamp: isoDate,
      date:      dateStr,
      sender:    sender.trim(),
      text,
      sentiment,
      group:     chatName,
      source:    'live',
    }

    // Write to Supabase (primary — accessible from Vercel)
    await insertMessage(entry)

    // Write to local JSON (backup for offline use)
    const messages = loadMessages()
    if (!messages.some(m => m.id === entry.id)) {
      messages.push(entry)
      saveMessages(messages)
    }

    console.log(`[msg] [${sentiment}] [${chatName}] ${sender}: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`)
  } catch (e) {
    console.error('[msg] Error processing message:', e.message)
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────
console.log('Starting WhatsApp service for STEDA dashboard…')
console.log(`Target groups: ${TARGET_GROUPS.map(g => `"${g}"`).join(', ')}`)
console.log(`DB: ${process.env.DB_HOST}`)
console.log()

writeStatus('starting')
ensureTable()
  .then(() => client.initialize())
  .catch(e => {
    console.error('[db] Could not connect to database:', e.message)
    console.log('[db] Starting without DB — local file only')
    client.initialize()
  })
