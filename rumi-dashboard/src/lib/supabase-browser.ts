import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Uses NEXT_PUBLIC_ vars so this works in browser (client components).
// null when unset (e.g. local dev without a .env.local) — callers must
// guard against that instead of relying on the realtime feed.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const supabaseBrowser: SupabaseClient | null = url && key ? createClient(url, key) : null
