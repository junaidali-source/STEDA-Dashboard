'use strict'
/**
 * One-shot backfill script — fetches all available messages from target groups
 * and upserts them to Supabase. Run INSTEAD of npm start (not alongside it).
 *
 *   node backfill-recent.js
 */

require('dotenv').config({ path: '../.env' })
const { Client, LocalAuth } = require('whatsapp-web.js')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

const TARGET_GROUPS = (process.env.WA_GROUP_NAME || 'rumi onboarding / feedback')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

const ADMINS = new Set([
  'Sajid Hussain Mallah', 'Junaid Ali', 'You',
  'Afzal ahmed', 'GUL HASSAN', 'Ayaz Iqbal Jokhio',
])

const SINCE = new Date('2026-03-27T00:00:00.000Z')  // fetch everything from this date

const POS_KW = ['great','amazing','wonderful','thrilled','fantastic','mind','superb','awesome',
  'useful','helpful','thank','hats off','proud','initiative','glad','love']
const ISS_KW = ['problem','issue','glitch','not work','error','slow','not receiv','nahi',
  'cannot',"can't",'waiting','never get']
const Q_KW = ['how','what','where','kaise','kia','kya']

function classifySentiment(text) {
  const lower = text.toLowerCase()
  if (POS_KW.some(k => lower.includes(k))) return 'positive'
  if (ISS_KW.some(k => lower.includes(k))) return 'issue'
  if (text.includes('?') || Q_KW.some(k => lower.includes(k))) return 'question'
  return 'other'
}

async function upsert(entry) {
  const { error } = await supabase
    .from('whatsapp_messages')
    .upsert(entry, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

// headless: false — WA Web's virtual message list only loads more messages when
// the browser has a real rendered viewport. In headless mode the scroll events
// are ignored and only the initial ~19 cached messages are ever available.
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
  puppeteer: {
    headless: false,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
           '--disable-accelerated-2d-canvas','--no-first-run','--no-zygote'],
    defaultViewport: { width: 1280, height: 900 },
  },
})

client.on('qr', () => {
  console.log('❌  Session expired — run npm start first to re-authenticate, then re-run this script.')
  process.exit(1)
})

client.on('auth_failure', () => { console.error('Auth failed'); process.exit(1) })

client.on('ready', async () => {
  console.log('✓  WhatsApp ready\n')
  try {
    const allChats = await client.getChats()
    const groups   = allChats.filter(c => c.isGroup || c.isCommunity)

    console.log('Available groups:')
    groups.forEach(g => console.log(`  • "${g.name}"`))
    console.log()

    const targets = groups.filter(g =>
      TARGET_GROUPS.some(t => g.name.toLowerCase().includes(t))
    )

    if (!targets.length) {
      console.log('⚠  No matching groups found. Check WA_GROUP_NAME in .env')
      console.log('   Target patterns:', TARGET_GROUPS)
      process.exit(0)
    }

    let grandTotal = 0

    for (const chat of targets) {
      console.log(`\n── Fetching "${chat.name}" ──`)
      const chatId = chat.id._serialized

      // fetchMessages() crashes unless the chat has been "opened" in the WA Web UI.
      // Fix: click the chat row in the DOM to trigger WA Web's full initialisation
      // (loads messages into the in-page store), then use loadEarlierMsgs to scroll
      // back through history inside the page context.
      console.log('   Opening chat via DOM click…')
      await client.pupPage.setDefaultTimeout(180000)

      const clickOk = await client.pupPage.evaluate(async (chatName) => {
        const selectors = ['[data-testid="cell-frame-title"]', 'span[title]', '[title]']
        for (const sel of selectors) {
          for (const el of document.querySelectorAll(sel)) {
            const text = (el.textContent || el.getAttribute('title') || '').toLowerCase()
            if (text.includes('rumi') && text.includes('feedback')) {
              const row = el.closest('[role="listitem"]') || el.closest('[data-testid="cell-frame-container"]') || el.parentElement?.parentElement
              ;(row || el).click()
              return true
            }
          }
        }
        return false
      }, chat.name)
      console.log('   DOM click:', clickOk ? 'ok' : 'not found, continuing anyway')
      await new Promise(r => setTimeout(r, 10000))   // let WA Web load the chat view

      // Use mouse.wheel (real browser event) to scroll WA Web's virtual message
      // list upward — this triggers the IntersectionObserver that loads earlier
      // message pages. scrollTop manipulation inside evaluate() is ignored by
      // WA Web's virtual scroll renderer in headless mode.
      console.log('   mouse.wheel scroll-loading to', SINCE.toISOString().slice(0,10), '…')
      await client.pupPage.setViewport({ width: 1280, height: 900 })

      // Move cursor into the message panel (right-hand side of WA Web layout)
      await client.pupPage.mouse.move(850, 450)

      let prevCount = 0, staleRounds = 0
      for (let round = 0; round < 400; round++) {
        // Scroll up hard — deltaY negative = scroll up in the message list
        await client.pupPage.mouse.wheel({ deltaY: -5000 })
        await new Promise(r => setTimeout(r, 400))

        const state = await client.pupPage.evaluate(async (chatId, sinceMs) => {
          const chat = await window.WWebJS.getChat(chatId, { getAsModel: false })
          const msgs = chat?.msgs?.getModelsArray() || []
          return {
            count:  msgs.length,
            oldest: msgs.length ? Math.min(...msgs.map(m => m.t)) * 1000 : Date.now(),
          }
        }, chatId, SINCE.getTime())

        if (state.count !== prevCount) {
          process.stdout.write(`   ${state.count} msgs, oldest ${new Date(state.oldest).toISOString().slice(0,10)}\r`)
          staleRounds = 0
        } else {
          staleRounds++
          if (staleRounds >= 15) break   // ~6 s of no progress
        }
        prevCount = state.count
        if (state.oldest <= SINCE.getTime()) break
      }
      console.log()   // newline after \r progress line

      const rawMsgs = await client.pupPage.evaluate(async (chatId) => {
        const chat = await window.WWebJS.getChat(chatId, { getAsModel: false })
        if (!chat) return { error: 'no chat', messages: [] }
        const allMsgs = chat.msgs.getModelsArray()
        return {
          total: allMsgs.length,
          messages: allMsgs.map(m => ({
            id:         m.id?._serialized || '',
            body:       m.body || '',
            timestamp:  m.t,
            notifyName: m._data?.notifyName || m._data?.pushname || '',
            author:     m.author?._serialized || m.from?._serialized || '',
            from:       m.from?._serialized || '',
          }))
        }
      }, chatId)

      if (rawMsgs.error) {
        console.error('   Page error:', rawMsgs.error)
        continue
      }

      console.log(`   Total messages loaded in store: ${rawMsgs.total}`)
      const messages = rawMsgs.messages
      console.log(`   Fetched ${messages.length} messages from page store`)

      const dates = messages.map(m => m.timestamp * 1000).sort((a,b) => a-b)
      if (dates.length) {
        console.log(`   Date range: ${new Date(dates[0]).toISOString().slice(0,10)} → ${new Date(dates[dates.length-1]).toISOString().slice(0,10)}`)
      }

      // Filter to SINCE date
      const recent = messages.filter(m => new Date(m.timestamp * 1000) >= SINCE)
      console.log(`   Messages from ${SINCE.toISOString().slice(0,10)} onwards: ${recent.length}`)

      let saved = 0, skipped = 0, errors = 0

      for (const msg of recent) {
        try {
          const text = (msg.body || '').trim()
          if (!text || text.length <= 2) { skipped++; continue }
          if (text.includes('<Media') || text.includes('omitted')) { skipped++; continue }
          const sender = msg.notifyName || msg.author || msg.from || 'Unknown'
          if (ADMINS.has(sender)) { skipped++; continue }

          const isoDate = new Date(msg.timestamp * 1000).toISOString()
          await upsert({
            id:        msg.id,
            timestamp: isoDate,
            date:      isoDate.slice(0, 10),
            sender:    String(sender).trim(),
            text,
            sentiment: classifySentiment(text),
            grp:       chat.name,
            source:    'backfill',
          })
          saved++
          if (saved % 50 === 0) process.stdout.write(`   Saved ${saved}...\r`)
        } catch (e) {
          errors++
          if (errors <= 3) console.error('   upsert error:', e.message)
        }
      }

      console.log(`   ✓  Saved: ${saved}  |  Skipped: ${skipped}  |  Errors: ${errors}`)
      grandTotal += saved
    }

    console.log(`\n✅  Done — ${grandTotal} messages upserted to Supabase`)

    // Verify
    const { count } = await supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact', head: true })
    console.log(`📊  Total messages now in Supabase: ${count}`)

  } catch (e) {
    console.error('Error:', e.message)
  } finally {
    await client.destroy()
    process.exit(0)
  }
})

console.log('Connecting to WhatsApp (reusing saved session)…')
client.initialize()
