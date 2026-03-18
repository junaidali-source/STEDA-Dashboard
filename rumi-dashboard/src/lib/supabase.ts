import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.SUPABASE_URL!
const supabaseKey  = process.env.SUPABASE_ANON_KEY!

// Single shared client (server-side only — no NEXT_PUBLIC_ prefix)
export const supabase = createClient(supabaseUrl, supabaseKey)
