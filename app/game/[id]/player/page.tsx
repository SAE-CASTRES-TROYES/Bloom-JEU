'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PlayerPage() {
  const { id } = useParams()
  const [player, setPlayer] = useState<any>(null)
  const [game, setGame] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const playerId = localStorage.getItem('player_id')

      const { data: p } = await supabase
        .from('players')
        .select()
        .eq('id', playerId)
        .single()
      setPlayer(p)

      const { data: g } = await supabase
        .from('games')
        .select()
        .eq('id', id)
        .single()
      setGame(g)
    }
    load()

    // Écouter les changements de la partie en temps réel
    const sub = supabase
      .channel('game-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${id}`
      }, (payload) => {
        setGame(payload.new)
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [id])

  return (
    <main className="min-h-screen bg-green-50 flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold text-green-800">🌿 {player?.pseudo}</h1>

      {game?.phase === 'LOBBY' && (
        <div className="bg-white rounded-2xl p-6 shadow text-center">
          <p className="text-gray-500 text-lg">En attente du début de la partie...</p>
          <p className="text-4xl mt-4">⏳</p>
          <p className="text-gray-400 mt-2">Le Grand Arbre va bientôt lancer la partie</p>
        </div>
      )}

      {game?.phase === 'ROLE' && player?.role && (
        <div className={`rounded-2xl p-8 shadow text-center text-white ${
          player.role === 'ronce' ? 'bg-red-700' : 'bg-green-700'
        }`}>
          <p className="text-2xl font-bold mb-4">Ton rôle secret :</p>
          <p className="text-5xl mb-4">
            {player.role === 'ronce' ? '🥀' : '🌸'}
          </p>
          <p className="text-3xl font-bold">
            {player.role === 'ronce' ? 'Ronce' : 'Jardinier'}
          </p>
          <p className="text-sm mt-4 opacity-80">
            {player.role === 'ronce' 
              ? 'Sabote discrètement la floraison sans te faire repérer !'
              : 'Coopère pour faire éclore les 5 fleurs légendaires !'}
          </p>
        </div>
      )}
    </main>
  )
}