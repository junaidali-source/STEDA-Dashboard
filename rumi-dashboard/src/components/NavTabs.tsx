'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ALL_TABS = [
  { href: '/',       label: 'Overview',      roles: ['admin'] },
  { href: '/report', label: 'Cohort Report', roles: ['admin'] },
  { href: '/steda',  label: 'STEDA Report',  roles: ['admin', 'steda'] },
]

export default function NavTabs({ role }: { role: string }) {
  const path = usePathname()
  const tabs = ALL_TABS.filter(t => t.roles.includes(role))

  return (
    <nav className="flex items-center gap-1">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            path === t.href
              ? 'bg-indigo-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-800'
          }`}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
