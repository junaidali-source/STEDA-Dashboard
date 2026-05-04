require('dotenv').config({ path: '../.env' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

async function test() {
  const { data, error, count } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact' })
    .limit(5)

  if (error) {
    console.error('SELECT FAILED:', error.message)
  } else {
    console.log('Row count:', count)
    console.log('Sample rows:', JSON.stringify(data, null, 2))
  }
  process.exit(0)
}
test()
