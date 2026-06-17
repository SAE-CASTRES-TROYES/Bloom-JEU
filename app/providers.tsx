'use client'
import { useEffect, useState } from 'react'
import type { Lang } from '@/lib/translations'

const STORAGE_KEY = 'bloom_lang'
const VALID: Lang[] = ['fr', 'en', 'es']
const EVENT = 'bloom-lang'

// Appelé par LangSwitcher — écrit dans localStorage et notifie tous les useLang()
export function setLang(l: Lang) {
  localStorage.setItem(STORAGE_KEY, l)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: l }))
}

// Chaque composant qui appelle useLang() écoute l'événement et gère son propre état local
export function useLang() {
  const [lang, setLangState] = useState<Lang>('fr')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
    if (saved && VALID.includes(saved)) setLangState(saved)

    const onLang = (e: Event) => setLangState((e as CustomEvent<Lang>).detail)
    window.addEventListener(EVENT, onLang)
    return () => window.removeEventListener(EVENT, onLang)
  }, [])

  return { lang, setLang }
}

// Conservé pour la compatibilité avec layout.tsx
export function LangProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
