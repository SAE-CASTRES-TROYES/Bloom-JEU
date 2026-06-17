'use client'
import { useLang } from './providers'
import type { Lang } from '@/lib/translations'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
]

export function LangSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <div className={`flex gap-1 ${className}`}>
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
            lang === l.code
              ? 'bg-bloom-violet-dark text-white'
              : 'bg-bloom-violet-pale text-bloom-violet-dark'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
