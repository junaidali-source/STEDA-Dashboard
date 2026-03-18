import { NextResponse } from 'next/server'
import { parseWhatsAppChat } from '@/lib/whatsapp-parser'

// Dynamically parsed from the WhatsApp export file.
// Results are cached for 5 minutes. Drop a new export file to refresh.
export async function GET() {
  try {
    const data = await parseWhatsAppChat()
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
