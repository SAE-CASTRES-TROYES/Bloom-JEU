'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function Home() {
  const router = useRouter()
  const [pseudo, setPseudo] = useState('')
  const [code, setCode] = useState('')
  const [nbJoueurs, setNbJoueurs] = useState(4)
  const [loading, setLoading] = useState(false)

async function creerPartie() {
    if (!pseudo) { alert('Entre un pseudo !'); return }
    setLoading(true)
    const gameCode = generateCode()
    console.log('1. Création partie avec code:', gameCode)

    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({ code: gameCode, nb_joueurs: nbJoueurs })
      .select()
      .single()

    console.log('2. Game:', game, 'Erreur:', gameError)
    if (!game) { console.log('Pas de game !'); setLoading(false); return }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ game_id: game.id, pseudo, role: 'grand_arbre' })
      .select()
      .single()

    console.log('3. Player:', player, 'Erreur:', playerError)
    if (!player) { setLoading(false); return }

    localStorage.setItem('player_id', player.id)
    localStorage.setItem('game_id', game.id)
    router.push(`/game/${game.id}/table`)
  }

  async function rejoindrePartie() {
    if (!pseudo || !code) return
    setLoading(true)

    const { data: game } = await supabase
      .from('games')
      .select()
      .eq('code', code.toUpperCase())
      .single()

    if (!game) { alert('Partie introuvable !'); setLoading(false); return }

    const { data: player } = await supabase
      .from('players')
      .insert({ game_id: game.id, pseudo })
      .select()
      .single()

    localStorage.setItem('player_id', player.id)
    localStorage.setItem('game_id', game.id)
    router.push(`/game/${game.id}/player`)
  }

  return (
    <main className="min-h-screen bg-bloom-cream flex flex-col items-center justify-center gap-8 p-8">
      <img src="/logo.svg" alt="BLOOM" className="w-64" />

      <input
        className="border-2 border-bloom-violet-pale rounded-2xl p-3 text-lg w-64 bg-white shadow-md focus:outline-none focus:border-bloom-violet"
        placeholder="Ton pseudo"
        value={pseudo}
        onChange={e => setPseudo(e.target.value)}
      />

      <div className="flex flex-col gap-4 w-64">
        <select
          className="border-2 border-bloom-violet-pale rounded-2xl p-3 text-lg bg-white shadow-md"
          value={nbJoueurs}
          onChange={e => setNbJoueurs(Number(e.target.value))}
        >
          {[4,5,6,7,8].map(n => <option key={n} value={n}>{n} joueurs</option>)}
        </select>

        <button
          onClick={creerPartie}
          disabled={loading}
          className="bg-bloom-violet text-white rounded-2xl p-3 text-lg font-bold shadow-md hover:bg-bloom-violet/90 disabled:opacity-50"
        >
          🌱 Créer une partie (Grand Arbre)
        </button>

        <div className="flex gap-2">
          <input
            className="border-2 border-bloom-violet-pale rounded-2xl p-3 text-lg flex-1 bg-white shadow-md focus:outline-none focus:border-bloom-violet"
            placeholder="Code partie"
            value={code}
            onChange={e => setCode(e.target.value)}
          />
          <button
            onClick={rejoindrePartie}
            disabled={loading}
            className="bg-bloom-fuchsia text-white rounded-2xl p-3 text-lg font-bold shadow-md hover:bg-bloom-fuchsia/90 disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>
    </main>
  )
}