import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import NavTabs from '@/components/NavTabs'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rumi Analytics Dashboard',
  description: 'Teacher engagement analytics — Pakistan, Sri Lanka & Myanmar',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen antialiased`}>
        {/* GA4-style top navigation bar */}
        <header className="bg-gray-900 sticky top-0 z-50 border-b border-gray-800">
          <div className="max-w-screen-2xl mx-auto px-6 flex items-center gap-6 h-14">
            {/* Brand */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 bg-indigo-500 rounded-md flex items-center justify-center">
                <span className="text-white text-xs font-bold select-none">R</span>
              </div>
              <span className="text-white font-semibold text-sm">Rumi Analytics</span>
            </div>

            {/* Tab navigation */}
            <NavTabs />

            {/* Right side badge */}
            <span className="ml-auto text-xs text-gray-400 bg-gray-800 px-3 py-1 rounded-full shrink-0">
              Read-only · Live data
            </span>
          </div>
        </header>

        {children}
      </body>
    </html>
  )
}
