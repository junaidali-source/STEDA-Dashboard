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
const qrcodeTerm = require('qrcode-terminal')
const qrcodeImg  = require('qrcode')
const { createClient } = require('@supabase/supabase-js')
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

// ── Supabase client ───────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function ensureTable() {
  // Table must be created in Supabase Dashboard SQL Editor — anon key cannot run DDL.
  // Just verify the connection by running a lightweight query.
  const { error } = await supabase.from('whatsapp_messages').select('id').limit(1)
  if (error) throw new Error(error.message)
  console.log('[db] whatsapp_messages table ready')
}

async function insertMessage(entry) {
  const { error } = await supabase
    .from('whatsapp_messages')
    .upsert({
      id:        entry.id,
      timestamp: entry.timestamp,
      date:      entry.date,
      sender:    entry.sender,
      text:      entry.text,
      sentiment: entry.sentiment,
      grp:       entry.group,
      source:    'live',
    }, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
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

// ── Clean up stale Chrome lock files before initializing ──────────────────────
const SESSION_DIR = path.join(__dirname, '.wwebjs_auth', 'session')
const LOCK_FILES  = ['DevToolsActivePort', 'lockfile', 'SingletonLock', 'SingletonCookie']
for (const f of LOCK_FILES) {
  const fp = path.join(SESSION_DIR, f)
  try { if (fs.existsSync(fp)) { fs.unlinkSync(fp); console.log(`[startup] Removed stale lock: ${f}`) } } catch {}
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

client.on('qr', async (qr) => {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Scan this QR code with WhatsApp on your phone')
  console.log('  (Settings → Linked Devices → Link a Device)')
  console.log('  QR code is also visible on the dashboard.')
  console.log('══════════════════════════════════════════════\n')
  qrcodeTerm.generate(qr, { small: true })
  writeStatus('waiting_for_qr')
  // Relay QR to dashboard via Supabase
  try {
    const dataUrl = await qrcodeImg.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 2, width: 256 })
    await setWaStatus('waiting_for_qr', { qr_code: dataUrl, groups: null })
  } catch (e) {
    console.error('[qr] Failed to relay QR to Supabase:', e.message)
  }
})

client.on('authenticated', async () => {
  console.log('[auth] Authenticated — session saved.')
  writeStatus('authenticated')
  // Clear QR from dashboard once authenticated
  await setWaStatus('authenticated', { qr_code: null })
})

client.on('auth_failure', (msg) => {
  console.error('[auth] Authentication failed:', msg)
  writeStatus('auth_failure', { error: msg })
})

async function pingHeartbeat() {
  await supabase.from('wa_heartbeat').upsert({ id: 1, updated_at: new Date().toISOString(), wa_status: 'connected' }, { onConflict: 'id' })
}

async function setWaStatus(status, extra = {}) {
  try {
    await supabase.from('wa_heartbeat').upsert(
      { id: 1, wa_status: status, updated_at: new Date().toISOString(), ...extra },
      { onConflict: 'id' }
    )
  } catch (e) {
    console.error('[wa_status] Failed to update status:', e.message)
  }
}

// ── Backfill: fetch full group history and upsert to Supabase ────────────────
async function backfillHistory(chat) {
  console.log(`[backfill] Fetching history for "${chat.name}"…`)
  try {
    const messages = await chat.fetchMessages({ limit: 5000 })
    let saved = 0, skipped = 0
    for (const msg of messages) {
      try {
        const text = msg.body?.trim() ?? ''
        if (!text || text.length <= 5) { skipped++; continue }
        if (text.includes('<Media') || text.includes('omitted')) { skipped++; continue }
        const sender = msg._data?.notifyName ?? msg.author ?? 'Unknown'
        if (ADMINS.has(sender)) { skipped++; continue }
        const isoDate = new Date(msg.timestamp * 1000).toISOString()
        await insertMessage({
          id:        msg.id._serialized,
          timestamp: isoDate,
          date:      isoDate.slice(0, 10),
          sender:    sender.trim(),
          text,
          sentiment: classifySentiment(text),
          group:     chat.name,
          source:    'live',
        })
        saved++
      } catch { skipped++ }
    }
    console.log(`[backfill] "${chat.name}" — ${saved} saved, ${skipped} skipped`)
  } catch (e) {
    console.error(`[backfill] Error for "${chat.name}":`, e.message)
  }
}

client.on('ready', async () => {
  console.log('[ready] WhatsApp client is ready!')
  writeStatus('connected', { startedAt: new Date().toISOString() })

  // Write first heartbeat immediately, then every 60s
  await pingHeartbeat()
  setInterval(pingHeartbeat, 60_000)

  try {
    const chats = await client.getChats()
    const groups = chats.filter(c => c.isGroup || c.isCommunity)
    console.log('\n[ready] Available groups/communities:')
    groups.forEach(g => console.log(`  • "${g.name}"`))
    console.log()

    // Write connected status + group list to Supabase for dashboard
    const groupNames = groups.map(g => g.name)
    await setWaStatus('connected', { qr_code: null, groups: groupNames })

    // Backfill history for all target groups
    const targets = groups.filter(g =>
      TARGET_GROUPS.some(t => g.name.toLowerCase().includes(t))
    )
    if (targets.length === 0) {
      console.log('[backfill] No matching groups found for backfill.')
    }
    for (const chat of targets) {
      await backfillHistory(chat)
    }
  } catch (e) {
    console.error('[ready] Error:', e.message)
  }
})

client.on('disconnected', async (reason) => {
  console.log('[disconnected]', reason)
  writeStatus('disconnected', { reason })
  await setWaStatus('disconnected', { qr_code: null })
})

const SAFE_TYPES = new Set(['chat', 'image', 'video', 'audio', 'document', 'sticker'])

client.on('message_create', async (msg) => {
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
console.log(`Supabase: ${process.env.SUPABASE_URL}`)
console.log()

writeStatus('starting')
ensureTable()
  .then(() => client.initialize())
  .catch(e => {
    console.error('[db] Could not connect to database:', e.message)
    console.log('[db] Starting without DB — local file only')
    client.initialize()
  })
