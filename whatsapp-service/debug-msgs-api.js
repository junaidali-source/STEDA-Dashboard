'use strict'
require('dotenv').config({ path: '../.env' })
const { Client, LocalAuth } = require('whatsapp-web.js')
const path = require('path')

const TARGET = (process.env.WA_GROUP_NAME || 'rumi onboarding / feedback')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
  puppeteer: {
    headless: false,
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
    const allChats = await client.getChats()
    const chat = allChats.find(c =>
      (c.isGroup || c.isCommunity) &&
      TARGET.some(t => c.name.toLowerCase().includes(t))
    )
    if (!chat) { console.log('Group not found'); process.exit(0) }

    await client.pupPage.setDefaultTimeout(60000)
    try { await client.interface.openChatWindow(chat.id._serialized) } catch(e) {}
    await new Promise(r => setTimeout(r, 10000))

    const info = await client.pupPage.evaluate(async (chatId) => {
      const c = await window.WWebJS.getChat(chatId, { getAsModel: false })
      if (!c) return { error: 'no chat' }

      // Check _cachePolicy details
      const cp = c.msgs._cachePolicy
      const cpCollectionSame = cp?.collection === c.msgs  // is it the same msgs?
      const cpId = String(cp?.id)

      // Force hasPreloaded = true via backing property
      c.__x_hasPreloaded = true

      // Also force contextLoaded on msgLoadState just in case
      if (c.msgs.msgLoadState) {
        c.msgs.msgLoadState.__x_contextLoaded = true
      }

      // Check chat methods
      const hasWaitMethod = typeof c.waitForChatLoading === 'function'

      // Try nulling out _cachePolicy before calling loadEarlierMsgs
      const origCachePolicy = c.msgs._cachePolicy
      c.msgs._cachePolicy = null
      let result1 = null, err1 = null
      try {
        result1 = await window.Store.ConversationMsgs.loadEarlierMsgs(c, c.msgs)
        result1 = result1 ? result1.length : 0
      } catch(e) { err1 = e.message?.slice(0, 80) }
      c.msgs._cachePolicy = origCachePolicy  // restore

      // Try calling loadMsgsPromiseLoop directly (the internal loop function)
      // with explicit parameters to bypass the waitForChatLoading check
      let result3 = null, err3 = null
      try {
        result3 = await window.Store.ConversationMsgs.loadMsgsPromiseLoop(c, undefined, c.msgs, undefined, 'before', undefined, undefined, undefined)
        result3 = result3 ? result3.length : 0
      } catch(e) { err3 = e.message?.slice(0, 80) }

      // Query IndexedDB wawc for messages in this chat
      let idbCount = 0, idbErr = null, idbSample = null
      try {
        const db = await new Promise((res, rej) => {
          const req = indexedDB.open('wawc')
          req.onsuccess = e => res(e.target.result)
          req.onerror = e => rej(e.target.error)
        })
        const storeNames = Array.from(db.objectStoreNames)
        const chatIdStr = chatId  // the chatId passed in as param
        // Try to find a message store
        const msgStore = storeNames.find(n => n.toLowerCase().includes('msg') || n.toLowerCase().includes('message'))
        if (msgStore) {
          const count = await new Promise((res, rej) => {
            const tx = db.transaction(msgStore, 'readonly')
            const req = tx.objectStore(msgStore).count()
            req.onsuccess = e => res(e.target.result)
            req.onerror = e => rej(e.target.error)
          })
          idbCount = count
          // Get one sample record
          const sample = await new Promise((res, rej) => {
            const tx = db.transaction(msgStore, 'readonly')
            const req = tx.objectStore(msgStore).openCursor()
            req.onsuccess = e => {
              const cursor = e.target.result
              if (cursor) res(Object.keys(cursor.value))
              else res(null)
            }
            req.onerror = e => rej(e.target.error)
          })
          idbSample = { msgStore, count, sampleKeys: sample }
        } else {
          idbSample = { storeNames }
        }
        db.close()
      } catch(e) { idbErr = e.message }

      return {
        cpCollectionSame, cpId,
        hasWaitMethod,
        msgCount: c.msgs.getModelsArray().length,
        result1, err1,
        result3, err3,
        idbCount, idbErr, idbSample,
      }
    }, chat.id._serialized)

    if (info.error) { console.log('ERROR:', info.error); return }
    console.log('cpCollectionSame:', info.cpCollectionSame, '| cpId:', info.cpId)
    console.log('hasWaitMethod:', info.hasWaitMethod, '| msg count:', info.msgCount)
    console.log('loadEarlierMsgs (null cachePolicy):', info.result1, '|', info.err1 || 'ok')
    console.log('loadMsgsPromiseLoop direct:', info.result3, '|', info.err3 || 'ok')
    console.log('IndexedDB wawc:', JSON.stringify(info.idbSample), '| err:', info.idbErr || 'none')
  } catch(e) {
    console.error('Error:', e.message)
  } finally {
    await client.destroy()
    process.exit(0)
  }
})

client.initialize()
