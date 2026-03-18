'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/',       label: 'Overview'      },
  { href: '/report', label: 'Cohort Report' },
  { href: '/steda',  label: 'STEDA Report'  },
]

export default function NavTabs() {
  const path = usePathname()
  return (
    <nav className="flex items-center gap-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            path === t.href
              ? 'bg-indigo-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-800'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
