'use client'
import { useLang } from './providers'
import type { Lang } from '@/lib/translations'

function FlagFR() {
  return (
    <svg width="28" height="20" viewBox="0 0 3 2" aria-hidden>
      <rect width="1" height="2" fill="#002395"/>
      <rect x="1" width="1" height="2" fill="#fff"/>
      <rect x="2" width="1" height="2" fill="#ED2939"/>
    </svg>
  )
}

function FlagEN() {
  return (
    <svg width="28" height="20" viewBox="0 0 60 30" aria-hidden>
      <rect width="60" height="30" fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4"/>
      <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10"/>
      <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6"/>
    </svg>
  )
}

function FlagES() {
  return (
    <svg width="28" height="20" viewBox="0 0 3 2" aria-hidden>
      <rect width="3" height="2" fill="#AA151B"/>
      <rect y="0.5" width="3" height="1" fill="#F1BF00"/>
    </svg>
  )
}

const LANGS: { code: Lang; label: string; Flag: () => React.JSX.Element }[] = [
  { code: 'fr', label: 'Français', Flag: FlagFR },
  { code: 'en', label: 'English',  Flag: FlagEN },
  { code: 'es', label: 'Español',  Flag: FlagES },
]

export function LangSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <div className={`flex gap-2 ${className}`}>
      {LANGS.map(({ code, label, Flag }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-label={label}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all overflow-hidden ${
            lang === code
              ? 'ring-2 ring-bloom-violet-dark ring-offset-1 shadow-sm scale-105'
              : 'opacity-60 hover:opacity-90'
          }`}
        >
          <Flag />
        </button>
      ))}
    </div>
  )
}
