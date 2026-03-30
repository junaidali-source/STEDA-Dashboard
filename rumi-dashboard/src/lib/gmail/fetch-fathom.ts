import { google } from 'googleapis'

export interface FathomEmail {
  threadId: string
  messageId: string
  subject: string
  date: string
  body: string
  fathomUrl: string
}

function getGmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth })
}

export async function fetchFathomEmails(): Promise<FathomEmail[]> {
  const gmail = getGmailClient()

  const { data } = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:no-reply@fathom.video subject:"Recap" after:2026/01/01',
    maxResults: 20,
  })

  if (!data.messages) return []

  const emails: FathomEmail[] = []

  for (const msg of data.messages) {
    const { data: full } = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'full',
    })

    const headers = full.payload?.headers || []
    const subject = headers.find(h => h.name === 'Subject')?.value || ''
    const date    = headers.find(h => h.name === 'Date')?.value    || ''

    let body = ''
    const parts = full.payload?.parts || [full.payload]
    for (const part of parts) {
      if (part?.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8')
        break
      }
    }

    const fathomMatch = body.match(/https:\/\/fathom\.video\/share\/[^\s\n\r"]+/)
    const fathomUrl   = fathomMatch ? fathomMatch[0] : ''

    emails.push({ threadId: full.threadId || msg.id!, messageId: msg.id!, subject, date, body, fathomUrl })
  }

  return emails
}
