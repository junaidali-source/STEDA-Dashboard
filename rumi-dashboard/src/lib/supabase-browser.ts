import { createClient } from '@supabase/supabase-js'

// Uses NEXT_PUBLIC_ vars so this works in browser (client components)
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
