'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FLEURS } from '@/lib/game'

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>()
  const [player, setPlayer]       = useState<any>(null)
  const [game, setGame]           = useState<any>(null)
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)

  const [confirmation, setConfirmation]     = useState(false)
  const [missionSignalee, setMissionSignalee] = useState(false)
  const [aVote, setAVote]                   = useState(false)
  const [voteSubmitting, setVoteSubmitting] = useState(false)

  useEffect(() => {
    const playerId = localStorage.getItem('player_id')

    async function load() {
      if (playerId) {
        const { data: p } = await supabase.from('players').select().eq('id', playerId).single()
        setPlayer(p)
      }
      const { data: g } = await supabase.from('games').select().eq('id', id).single()
      setGame(g)
      const { data: allP } = await supabase.from('players').select().eq('game_id', id)
      setAllPlayers(allP || [])
      setLoading(false)
    }
    load()

    const gameChannel = supabase
      .channel(`game-player-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, (payload) => {
        setGame(payload.new)
      })
      .subscribe()

    const playerChannel = playerId
      ? supabase
          .channel(`player-self-${playerId}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `id=eq.${playerId}` }, (payload) => {
            setPlayer(payload.new)
          })
          .subscribe()
      : null

    const allPlayersChannel = supabase
      .channel(`all-players-player-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${id}` }, (payload) => {
        setAllPlayers(prev => prev.some(p => p.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `game_id=eq.${id}` }, (payload) => {
        setAllPlayers(prev => prev.map(p => p.id === payload.new.id ? payload.new : p))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(gameChannel)
      if (playerChannel) supabase.removeChannel(playerChannel)
      supabase.removeChannel(allPlayersChannel)
    }
  }, [id])

  // Réinitialise les états locaux à chaque nouvelle fleur
  useEffect(() => {
    setMissionSignalee(false)
    setAVote(false)
  }, [game?.fleur_index])

  // ── Actions ───────────────────────────────────────────────────────────────

  async function confirmerRole() {
    if (!player) return
    setConfirmation(true)
    const { error } = await supabase.from('players').update({ mission_accomplie: true }).eq('id', player.id)
    if (error) { console.error(error); setConfirmation(false); return }
    setPlayer((prev: any) => ({ ...prev, mission_accomplie: true }))
  }

  async function signalerMission(resultat: 'reussi' | 'echec') {
    if (!player || missionSignalee) return
    setMissionSignalee(true)
    const { error } = await supabase.from('players').update({ mission_resultat: resultat }).eq('id', player.id)
    if (error) { console.error(error); setMissionSignalee(false) }
  }

  async function soumettreVote(suspectId: string) {
    if (!player || aVote || voteSubmitting) return
    setVoteSubmitting(true)
    const { error } = await supabase.from('votes').insert({
      game_id: id,
      fleur_index: game?.fleur_index ?? 0,
      votant_id: player.id,
      suspect_id: suspectId,
    })
    if (!error) setAVote(true)
    setVoteSubmitting(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

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

  const estRonce  = player.role === 'ronce'
  const fleur     = game?.fleur_index !== undefined ? FLEURS[game.fleur_index] : null
  const suspects  = allPlayers.filter(p => p.id !== player.id && p.role !== 'grand_arbre' && !p.elimine)

  return (
    <main className="min-h-screen bg-bloom-cream-light flex flex-col items-center px-5 py-8 gap-6">
      <img src="/logo.svg" alt="BLOOM" className="w-28" />
      <h1 className="font-title text-2xl text-bloom-violet-dark">🌿 {player.pseudo}</h1>

      {/* ── LOBBY ── */}
      {game?.phase === 'LOBBY' && (
        <div className="w-[90%] max-w-sm mx-auto bg-white rounded-2xl p-6 shadow-md text-center">
          <p className="text-5xl animate-pulse">🌸</p>
          <p className="font-title text-xl text-bloom-violet-dark mt-4">En attente du Grand Arbre...</p>
          <p className="text-base text-bloom-violet-medium mt-2">La partie va bientôt commencer</p>
        </div>
      )}

      {/* ── ROLE ── */}
      {game?.phase === 'ROLE' && player.role && (
        <div className={`w-[90%] max-w-sm mx-auto rounded-2xl p-6 shadow-md text-center ${estRonce ? 'bg-bloom-rose-light' : 'bg-bloom-green-light'}`}>
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
            className={`min-h-[52px] text-white rounded-2xl px-6 text-base font-bold shadow-md disabled:opacity-60 mt-6 w-full ${estRonce ? 'bg-bloom-rose' : 'bg-bloom-green'}`}
          >
            {player.mission_accomplie ? '✓ Compris !' : "J'ai pris connaissance de mon rôle"}
          </button>
        </div>
      )}

      {/* ── FLEUR EN COURS ── */}
      {game?.phase === 'FLEUR_EN_COURS' && (
        <div className="w-[90%] max-w-sm mx-auto flex flex-col gap-4">
          {/* Rappel fleur */}
          {fleur && (
            <div className="bg-white rounded-2xl p-5 text-center shadow-md">
              <p className="text-5xl">{fleur.emoji}</p>
              <p className="font-title text-xl text-bloom-violet-dark mt-2">{fleur.nom}</p>
              <p className="text-sm text-bloom-violet-medium mt-1">Fleur {(game?.fleur_index ?? 0) + 1} / 5</p>
            </div>
          )}

          {/* Mission secrète */}
          {player.mission && (
            <div className={`rounded-2xl p-5 shadow-md ${estRonce ? 'bg-bloom-rose-light' : 'bg-bloom-violet-pale'}`}>
              <p className="font-title text-base text-bloom-black mb-2">Ta mission 🎯</p>
              <p className="text-base text-bloom-gray-dark">{player.mission.texte}</p>
            </div>
          )}

          {/* Boutons mission — gros, tactile */}
          {!missionSignalee ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => signalerMission('reussi')}
                className="w-full min-h-[72px] bg-bloom-green text-white rounded-2xl px-6 text-lg font-bold shadow-md"
              >
                ✅ J&apos;ai réussi ma mission
              </button>
              <button
                onClick={() => signalerMission('echec')}
                className="w-full min-h-[72px] bg-bloom-rose text-white rounded-2xl px-6 text-lg font-bold shadow-md"
              >
                ❌ J&apos;ai échoué ma mission
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 text-center shadow-md">
              <p className="text-4xl">✓</p>
              <p className="font-title text-lg text-bloom-violet-dark mt-2">Réponse enregistrée</p>
              <p className="text-sm text-bloom-violet-medium mt-1">En attente du Grand Arbre...</p>
            </div>
          )}
        </div>
      )}

      {/* ── CONSÉQUENCES ── */}
      {game?.phase === 'CONSEQUENCES' && (
        <div className="w-[90%] max-w-sm mx-auto bg-white rounded-2xl p-6 shadow-md text-center">
          <p className="text-5xl animate-pulse">⏳</p>
          <p className="font-title text-xl text-bloom-violet-dark mt-4">Le Grand Arbre prépare la suite...</p>
        </div>
      )}

      {/* ── VOTE ── */}
      {game?.phase === 'VOTE' && (
        <div className="w-[90%] max-w-sm mx-auto flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-5 text-center shadow-md">
            <p className="text-4xl">🗳️</p>
            <p className="font-title text-xl text-bloom-violet-dark mt-2">Phase de vote</p>
            <p className="text-sm text-bloom-violet-medium mt-1">Désigne un suspect Ronce</p>
          </div>

          {!game?.vote_lance ? (
            <div className="bg-white rounded-2xl p-5 text-center shadow-md">
              <p className="text-5xl animate-pulse">⏳</p>
              <p className="font-title text-lg text-bloom-violet-dark mt-3">Le Grand Arbre va lancer le vote...</p>
            </div>
          ) : !aVote ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-bloom-violet-medium text-center">Tape sur le joueur que tu suspectes</p>
              {suspects.map(s => (
                <button
                  key={s.id}
                  onClick={() => soumettreVote(s.id)}
                  disabled={voteSubmitting}
                  className="w-full min-h-[64px] bg-white border-2 border-bloom-violet-light rounded-2xl px-5 text-base font-bold text-bloom-gray-dark shadow-md disabled:opacity-50 text-left"
                >
                  🌿 {s.pseudo}
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center shadow-md">
              <p className="text-4xl">✓</p>
              <p className="font-title text-lg text-bloom-violet-dark mt-2">Vote enregistré !</p>
              <p className="text-sm text-bloom-violet-medium mt-1">En attente des autres joueurs...</p>
            </div>
          )}
        </div>
      )}

      {/* ── FIN ── */}
      {game?.phase === 'FIN' && (
        <div className="w-[90%] max-w-sm mx-auto bg-white rounded-2xl p-6 shadow-md text-center">
          <p className="text-5xl">🌺</p>
          <p className="font-title text-xl text-bloom-violet-dark mt-4">Partie terminée !</p>
          <p className="text-base text-bloom-violet-medium mt-2">Regardez le Grand Arbre pour le résultat final</p>
        </div>
      )}
    </main>
  )
}
