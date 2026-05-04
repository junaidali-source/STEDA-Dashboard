require('dotenv').config({ path: '../.env' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

async function cleanup() {
  const { error } = await supabase
    .from('whatsapp_messages')
    .delete()
    .like('id', 'test_%')
  console.log(error ? 'Error: ' + error.message : 'Test rows cleaned up')
  process.exit(0)
}
cleanup()
