'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function TablePage() {
  const { id } = useParams()
  const [game, setGame] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [code, setCode] = useState('')

  useEffect(() => {
    // Charger la partie
    async function load() {
      const { data: g } = await supabase
        .from('games')
        .select()
        .eq('id', id)
        .single()
      setGame(g)
      setCode(g?.code)

      const { data: p } = await supabase
        .from('players')
        .select()
        .eq('game_id', id)
      setPlayers(p || [])
    }
    load()

    // Écouter les nouveaux joueurs en temps réel
    const sub = supabase
      .channel('players')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
        filter: `game_id=eq.${id}`
      }, (payload) => {
        setPlayers(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [id])

  return (
    <main className="min-h-screen bg-green-900 text-white flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-6xl font-bold">🌳 Le Grand Arbre</h1>

      <div className="bg-green-700 rounded-2xl p-6 text-center">
        <p className="text-green-300 text-lg">Code de la partie</p>
        <p className="text-5xl font-mono font-bold tracking-widest">{code}</p>
        <p className="text-green-300 mt-2">Les joueurs rejoignent sur leur téléphone</p>
      </div>

      <div className="bg-green-800 rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-4">
          Joueurs connectés ({players.filter(p => p.role !== 'grand_arbre').length}/{game?.nb_joueurs})
        </h2>
        <div className="flex flex-col gap-2">
          {players
            .filter(p => p.role !== 'grand_arbre')
            .map(p => (
              <div key={p.id} className="bg-green-700 rounded-xl p-3 text-lg">
                🌿 {p.pseudo}
              </div>
            ))}
        </div>
      </div>

      {players.filter(p => p.role !== 'grand_arbre').length === game?.nb_joueurs && (
        <button className="bg-pink-500 text-white rounded-2xl p-4 text-2xl font-bold hover:bg-pink-600">
          🌸 Lancer la partie !
        </button>
      )}
    </main>
  )
}