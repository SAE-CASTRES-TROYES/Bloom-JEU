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
      <main className="min-h-screen bg-bloom-cream-light flex items-center justify-center px-5">
        <p className="font-title text-xl text-bloom-violet-dark">Chargement...</p>
      </main>
    )
  }

  if (!player) {
    return (
      <main className="min-h-screen bg-bloom-cream-light flex flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-lg text-bloom-rose font-bold">Joueur introuvable.</p>
        <p className="text-base text-bloom-gray-dark">Rejoins la partie depuis la page d&apos;accueil.</p>
      </main>
    )
  }

  const estRonce = player.role === 'ronce'

  return (
    <main className="min-h-screen bg-bloom-cream-light flex flex-col items-center px-5 py-8 gap-6">
      <img src="/logo.svg" alt="BLOOM" className="w-28" />
      <h1 className="font-title text-2xl text-bloom-violet-dark">🌿 {player.pseudo}</h1>

      {game?.phase === 'LOBBY' && (
        <div className="w-[90%] max-w-sm mx-auto bg-white rounded-2xl p-6 shadow-md text-center">
          <p className="text-5xl animate-pulse">🌸</p>
          <p className="font-title text-xl text-bloom-violet-dark mt-4">En attente du Grand Arbre...</p>
          <p className="text-base text-bloom-violet-medium mt-2">La partie va bientôt commencer</p>
        </div>
      )}

      {game?.phase === 'ROLE' && player.role && (
        <div
          className={`w-[90%] max-w-sm mx-auto rounded-2xl p-6 shadow-md text-center ${
            estRonce ? 'bg-bloom-rose-light' : 'bg-bloom-green-light'
          }`}
        >
          <p className="text-6xl mb-3">{estRonce ? '🥀' : '🌸'}</p>
          <p className="font-title text-3xl text-bloom-black mb-3">{estRonce ? 'Ronce' : 'Jardinier'}</p>
          <p className="text-base text-bloom-gray-dark">
            {estRonce
              ? 'Sabote discrètement la floraison sans te faire repérer !'
              : 'Coopère pour faire éclore les 5 fleurs légendaires !'}
          </p>

          {player.mission && (
            <div className={`rounded-xl p-4 mt-6 text-left ${estRonce ? 'bg-bloom-cream' : 'bg-bloom-violet-pale'}`}>
              <p className="font-title text-lg text-bloom-black mb-2">Ta mission secrète 🎯</p>
              <p className="text-base text-bloom-gray-dark">{player.mission.texte}</p>
            </div>
          )}

          <button
            onClick={confirmerRole}
            disabled={player.mission_accomplie || confirmation}
            className={`min-h-[52px] text-white rounded-2xl px-6 text-base font-bold shadow-md disabled:opacity-60 mt-6 w-full ${
              estRonce ? 'bg-bloom-rose' : 'bg-bloom-green'
            }`}
          >
            {player.mission_accomplie ? '✓ Compris !' : "J'ai pris connaissance de mon rôle"}
          </button>
        </div>
      )}
    </main>
  )
}
