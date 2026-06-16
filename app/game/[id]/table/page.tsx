'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { construireDeck, distribuerRoles, tirerMission } from '@/lib/game'

export default function TablePage() {
  const { id } = useParams<{ id: string }>()
  const [game, setGame] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lancement, setLancement] = useState(false)
  const transitionDiscussionLancee = useRef(false)

  useEffect(() => {
    async function load() {
      const { data: g } = await supabase
        .from('games')
        .select()
        .eq('id', id)
        .single()
      setGame(g)

      const { data: p } = await supabase
        .from('players')
        .select()
        .eq('game_id', id)
      setPlayers(p || [])
      setLoading(false)
    }
    load()

    // Channels nommés par id : un nom de channel partagé (ex. "players") provoque
    // une erreur de double abonnement en dev avec React Strict Mode (effet monté 2x).
    const playersChannel = supabase
      .channel(`players-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
        filter: `game_id=eq.${id}`
      }, (payload) => {
        setPlayers(prev =>
          prev.some(p => p.id === payload.new.id) ? prev : [...prev, payload.new]
        )
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'players',
        filter: `game_id=eq.${id}`
      }, (payload) => {
        setPlayers(prev => prev.map(p => p.id === payload.new.id ? payload.new : p))
      })
      .subscribe()

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

    return () => {
      supabase.removeChannel(playersChannel)
      supabase.removeChannel(gameChannel)
    }
  }, [id])

  const joueurs = players.filter(p => p.role !== 'grand_arbre')
  const tousConnectes = !!game && joueurs.length === game.nb_joueurs
  const nbConfirmes = joueurs.filter(p => p.mission_accomplie).length
  const tousConfirmes = !!game && joueurs.length === game.nb_joueurs && nbConfirmes === joueurs.length

  useEffect(() => {
    if (game?.phase !== 'ROLE') {
      transitionDiscussionLancee.current = false
      return
    }
    if (tousConfirmes && !transitionDiscussionLancee.current) {
      transitionDiscussionLancee.current = true
      supabase.from('games').update({ phase: 'DISCUSSION' }).eq('id', id).then(({ data, error }) => {
        if (error) { console.error(error); transitionDiscussionLancee.current = false; return }
        setGame(data)
      })
    }
  }, [game?.phase, tousConfirmes, id])

  async function lancerPartie() {
    if (!game) return
    const deck = construireDeck(game.nb_joueurs)
    if (!deck) {
      alert(`Composition du deck non définie pour ${game.nb_joueurs} joueurs.`)
      return
    }
    setLancement(true)

    const roles = distribuerRoles(joueurs.map(j => j.id), game.nb_joueurs)
    let pioche = deck

    const updates = joueurs.map(j => {
      const role = roles[j.id]
      const main = pioche.slice(0, 4)
      pioche = pioche.slice(4)
      const mission = tirerMission(role)
      return supabase
        .from('players')
        .update({ role, main, mission, mission_accomplie: false })
        .eq('id', j.id)
    })

    const resultats = await Promise.all(updates)
    const echec = resultats.find(r => r.error)
    if (echec) {
      console.error(echec.error)
      setLancement(false)
      return
    }

    const { data, error } = await supabase
      .from('games')
      .update({ phase: 'ROLE' })
      .eq('id', id)
      .select()
      .single()
    if (error) {
      console.error(error)
      setLancement(false)
      return
    }
    setGame(data)
    setLancement(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-bloom-black text-white flex items-center justify-center">
        <p className="font-title text-2xl">Chargement...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bloom-black text-white flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="font-title text-6xl text-bloom-violet-light">🌸 BLOOM</h1>

      {game?.phase === 'LOBBY' && (
        <>
          <div className="bg-bloom-violet/20 border border-bloom-violet-pale/30 rounded-2xl p-6 text-center shadow-md">
            <p className="text-bloom-violet-pale text-lg">Code de la partie</p>
            <p className="font-mono text-5xl font-bold tracking-widest text-bloom-gold">{game?.code}</p>
            <p className="text-bloom-violet-pale mt-2">Les joueurs rejoignent sur leur téléphone</p>
          </div>

          <div className="bg-bloom-violet/10 border border-bloom-violet-pale/20 rounded-2xl p-6 w-full max-w-lg shadow-md">
            <h2 className="font-title text-2xl mb-4 text-bloom-violet-light">
              Joueurs connectés ({joueurs.length}/{game?.nb_joueurs})
            </h2>
            <div className="flex flex-col gap-2">
              {joueurs.map(p => (
                <div key={p.id} className="bg-bloom-violet/20 rounded-xl p-3 text-lg">
                  🌿 {p.pseudo}
                </div>
              ))}
            </div>
          </div>

          {tousConnectes && (
            <button
              onClick={lancerPartie}
              disabled={lancement}
              className="bg-bloom-violet text-white rounded-2xl p-4 text-2xl font-bold shadow-md hover:bg-bloom-violet/90 disabled:opacity-50"
            >
              Lancer la partie 🌱
            </button>
          )}
        </>
      )}

      {game?.phase === 'ROLE' && (
        <div className="bg-bloom-violet/10 border border-bloom-violet-pale/20 rounded-2xl p-8 w-full max-w-lg shadow-md text-center">
          <p className="font-title text-3xl text-bloom-violet-light mb-6">
            Distribution des rôles en cours... 🌸
          </p>
          <p className="text-xl text-bloom-gold-light">
            {nbConfirmes} joueur{nbConfirmes > 1 ? 's' : ''} ont découvert leur rôle / {game?.nb_joueurs}
          </p>
          <div className="flex flex-col gap-2 mt-6">
            {joueurs.map(p => (
              <div key={p.id} className="bg-bloom-violet/20 rounded-xl p-3 text-lg flex justify-between">
                <span>🌿 {p.pseudo}</span>
                <span>{p.mission_accomplie ? '✓' : '⏳'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
