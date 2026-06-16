'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>()
  const [player, setPlayer] = useState<any>(null)
  const [game, setGame] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [confirmation, setConfirmation] = useState(false)

  useEffect(() => {
    const playerId = localStorage.getItem('player_id')

    async function load() {
      if (playerId) {
        const { data: p } = await supabase
          .from('players')
          .select()
          .eq('id', playerId)
          .single()
        setPlayer(p)
      }

      const { data: g } = await supabase
        .from('games')
        .select()
        .eq('id', id)
        .single()
      setGame(g)
      setLoading(false)
    }
    load()

    // Channel nommé par id : un nom partagé (ex. "game-changes") provoque une
    // erreur de double abonnement en dev avec React Strict Mode (effet monté 2x).
    const gameChannel = supabase
      .channel(`game-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${id}`
      }, (payload) => {
        setGame(payload.new)
      })
      .subscribe()

    const playerChannel = playerId
      ? supabase
          .channel(`player-${playerId}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'players',
            filter: `id=eq.${playerId}`
          }, (payload) => {
            setPlayer(payload.new)
          })
          .subscribe()
      : null

    return () => {
      supabase.removeChannel(gameChannel)
      if (playerChannel) supabase.removeChannel(playerChannel)
    }
  }, [id])

  async function confirmerRole() {
    if (!player) return
    setConfirmation(true)
    const { error } = await supabase
      .from('players')
      .update({ mission_accomplie: true })
      .eq('id', player.id)
    if (error) {
      console.error(error)
      setConfirmation(false)
      return
    }
    setPlayer((prev: any) => ({ ...prev, mission_accomplie: true }))
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-bloom-cream flex items-center justify-center">
        <p className="font-title text-xl text-bloom-violet">Chargement...</p>
      </main>
    )
  }

  if (!player) {
    return (
      <main className="min-h-screen bg-bloom-cream flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-xl text-bloom-burgundy">Joueur introuvable.</p>
        <p className="text-bloom-violet-light">Rejoins la partie depuis la page d&apos;accueil.</p>
      </main>
    )
  }

  const estRonce = player.role === 'ronce'

  return (
    <main className="min-h-screen bg-bloom-cream flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="font-title text-3xl text-bloom-violet">🌿 {player.pseudo}</h1>

      {game?.phase === 'LOBBY' && (
        <div className="bg-white rounded-2xl p-6 shadow-md text-center animate-pulse">
          <p className="text-bloom-violet-light text-lg">En attente du Grand Arbre...</p>
          <p className="text-4xl mt-4">⏳</p>
          <p className="text-bloom-violet-pale mt-2">La partie va bientôt commencer</p>
        </div>
      )}

      {game?.phase === 'ROLE' && player.role && (
        <div
          className={`rounded-2xl p-8 shadow-md text-center text-white w-full max-w-sm ${
            estRonce ? 'bg-bloom-burgundy' : 'bg-bloom-sage'
          }`}
        >
          <p className="text-5xl mb-4">{estRonce ? '🥀' : '🌸'}</p>
          <p className="font-title text-3xl mb-4">{estRonce ? 'Ronce' : 'Jardinier'}</p>
          <p className="text-sm opacity-90">
            {estRonce
              ? 'Sabote discrètement la floraison sans te faire repérer !'
              : 'Coopère pour faire éclore les 5 fleurs légendaires !'}
          </p>

          {player.mission && (
            <div className="bg-black/20 rounded-xl p-4 mt-6 text-left">
              <p className="font-title text-lg mb-2">Ta mission secrète 🎯</p>
              <p className="text-sm">{player.mission.texte}</p>
            </div>
          )}

          <button
            onClick={confirmerRole}
            disabled={player.mission_accomplie || confirmation}
            className="bg-bloom-violet text-white rounded-2xl p-3 text-lg font-bold shadow-md hover:bg-bloom-violet/90 disabled:opacity-60 mt-6 w-full"
          >
            {player.mission_accomplie ? '✓ Compris !' : "J'ai pris connaissance de mon rôle"}
          </button>
        </div>
      )}
    </main>
  )
}
