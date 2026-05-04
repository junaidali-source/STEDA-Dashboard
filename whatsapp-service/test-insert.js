require('dotenv').config({ path: '../.env' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

async function test() {
  console.log('Testing Supabase insert...')
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .upsert({
      id: 'test_message_id_' + Date.now(),
      timestamp: new Date().toISOString(),
      date: '2026-03-18',
      sender: 'Test Teacher',
      text: 'This is a test message from the service',
      sentiment: 'positive',
      grp: 'Rumi onboarding / Feedback',
      source: 'live',
    }, { onConflict: 'id', ignoreDuplicates: true })

  if (error) {
    console.error('INSERT FAILED:', error.message, error.details, error.hint)
  } else {
    console.log('INSERT SUCCESS:', data)
  }
  process.exit(0)
}
test()
