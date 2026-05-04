'use strict'
require('dotenv').config({ path: '../.env' })
const { Client, LocalAuth } = require('whatsapp-web.js')
const path = require('path')

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
  puppeteer: {
    headless: false,
    protocolTimeout: 120000,   // 2 min for heavy IDB queries
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
           '--disable-accelerated-2d-canvas','--no-first-run','--no-zygote'],
    defaultViewport: { width: 1280, height: 900 },
  },
})

client.on('qr', () => { console.log('❌ Re-auth needed'); process.exit(1) })
client.on('auth_failure', () => { console.error('Auth failed'); process.exit(1) })

client.on('ready', async () => {
  console.log('✓ Ready')
  try {
    // Get the group chat ID first
    const allChats = await client.getChats()
    const chat = allChats.find(c => (c.isGroup || c.isCommunity) && c.name.toLowerCase().includes('rumi') && c.name.toLowerCase().includes('feedback'))
    if (!chat) { console.log('Group not found'); process.exit(0) }
    console.log('Group:', chat.name, '| ID:', chat.id._serialized)

    const chatWid = chat.id._serialized  // e.g. "120363XXXXXXXXX@g.us"
    const SINCE_TS = Math.floor(new Date('2026-03-27T00:00:00.000Z').getTime() / 1000)
    const UNTIL_TS = Math.floor(new Date('2026-04-17T00:00:00.000Z').getTime() / 1000)

    // Query IDB model-storage.message for this chat using the internalId index
    // internalId format is "<chatWid>_<msgTimestamp>_<seq>" or similar
    // We'll scan using key range on internalId index
    const result = await client.pupPage.evaluate(async (chatWid, sinceTs, untilTs) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('model-storage')
        r.onsuccess = e => res(e.target.result)
        r.onerror = e => rej(new Error(e.target.error?.message || 'open failed'))
      })

      const tx = db.transaction('message', 'readonly')
      const store = tx.objectStore('message')

      // Use internalId index to find messages for this chat
      // internalId starts with chatWid
      const idx = store.index('internalId')
      const lower = chatWid + '_'
      const upper = chatWid + '_\uffff'
      const range = IDBKeyRange.bound(lower, upper)

      const msgs = []
      await new Promise((res, rej) => {
        const req = idx.openCursor(range)
        req.onsuccess = e => {
          const cursor = e.target.result
          if (!cursor) { res(); return }
          const v = cursor.value
          if (v.t >= sinceTs && v.t <= untilTs) msgs.push(v)
          cursor.continue()
        }
        req.onerror = e => rej(e.target.error)
      })

      db.close()
      return msgs.map(m => ({
        id:         m.id,
        t:          m.t,
        from:       typeof m.from === 'string' ? m.from : m.from?._serialized || '',
        author:     typeof m.author === 'string' ? m.author : m.author?._serialized || '',
        body:       m.body || '',
        type:       m.type,
        internalId: m.internalId,
      }))
    }, chatWid, SINCE_TS, UNTIL_TS)

    console.log(`Found ${result.length} messages in IDB for date range`)
    if (result.length > 0) {
      console.log('Sample:', JSON.stringify(result[0]).slice(0, 200))
      const dates = result.map(m => m.t).sort((a,b)=>a-b)
      console.log('Date range:', new Date(dates[0]*1000).toISOString().slice(0,10), '→', new Date(dates[dates.length-1]*1000).toISOString().slice(0,10))
    }
  } catch(e) {
    console.error('Error:', e.message)
  } finally {
    await client.destroy()
    process.exit(0)
  }
})

console.log('Connecting…')
client.initialize()
