import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import NavTabs from '@/components/NavTabs'
import LogoutButton from '@/components/LogoutButton'
import { verifySessionToken } from '@/lib/auth'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rumi Analytics Dashboard',
  description: 'Teacher engagement analytics — Pakistan, Sri Lanka & Myanmar',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const token   = cookieStore.get('session')?.value
  const session = token ? await verifySessionToken(token) : null

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen antialiased`}>
        {session && (
          <header className="bg-gray-900 sticky top-0 z-50 border-b border-gray-800">
            <div className="max-w-screen-2xl mx-auto px-6 flex items-center gap-6 h-14">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 bg-indigo-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-xs font-bold select-none">R</span>
                </div>
                <span className="text-white font-semibold text-sm">Rumi Analytics</span>
              </div>

              <NavTabs role={session.role} />

              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-gray-500">{session.username}</span>
                <LogoutButton />
              </div>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  )
}
