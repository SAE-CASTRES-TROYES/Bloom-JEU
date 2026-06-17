'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FLEURS } from '@/lib/game'
import { t } from '@/lib/translations'
import { useLang } from '@/app/providers'

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>()
  const { lang } = useLang()
  const [player, setPlayer]         = useState<any>(null)
  const [game, setGame]             = useState<any>(null)
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [confirmation, setConfirmation]       = useState(false)
  const [missionSignalee, setMissionSignalee] = useState(false)
  const [aVote, setAVote]                     = useState(false)
  const [voteSubmitting, setVoteSubmitting]   = useState(false)

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
        <p className="font-title text-xl text-bloom-violet-dark">{t('chargement', lang)}</p>
      </main>
    )
  }

  if (!player) {
    return (
      <main className="min-h-screen bg-bloom-cream-light flex flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-lg text-bloom-rose font-bold">{t('joueur_introuvable', lang)}</p>
        <p className="text-base text-bloom-gray-dark">{t('rejoindre_accueil', lang)}</p>
      </main>
    )
  }

  const estRonce  = player.role === 'ronce'
  const estElimne = !!player.elimine
  const fleur     = game?.fleur_index !== undefined ? FLEURS[game.fleur_index] : null
  const suspects  = allPlayers.filter(p => p.id !== player.id && p.role !== 'grand_arbre' && !p.elimine)
  const joueurs   = allPlayers.filter(p => p.role !== 'grand_arbre' && p.role)

  return (
    <main className="min-h-screen bg-bloom-cream-light flex flex-col items-center px-5 py-8 gap-6">
      <img src="/logo.svg" alt="BLOOM" className="w-28" />
      <h1 className="font-title text-2xl text-bloom-violet-dark">🌿 {player.pseudo}</h1>

      {/* ── LOBBY ── */}
      {game?.phase === 'LOBBY' && (
        <div className="w-[90%] max-w-sm mx-auto bg-white rounded-2xl p-6 shadow-md text-center">
          <p className="text-5xl animate-pulse">🌸</p>
          <p className="font-title text-xl text-bloom-violet-dark mt-4">{t('en_attente_ga', lang)}</p>
          <p className="text-base text-bloom-violet-medium mt-2">{t('partie_bientot', lang)}</p>
        </div>
      )}

      {/* ── ROLE ── */}
      {game?.phase === 'ROLE' && player.role && (
        <div className={`w-[90%] max-w-sm mx-auto rounded-2xl p-6 shadow-md text-center ${estRonce ? 'bg-bloom-rose-light' : 'bg-bloom-green-light'}`}>
          <p className="text-6xl mb-3">{estRonce ? '🥀' : '🌸'}</p>
          <p className="font-title text-3xl text-bloom-black mb-3">{estRonce ? t('role_ronce', lang) : t('role_jardinier', lang)}</p>
          <p className="text-base text-bloom-gray-dark">
            {estRonce ? t('role_ronce_desc', lang) : t('role_jardinier_desc', lang)}
          </p>
          {player.mission && (
            <div className={`rounded-xl p-4 mt-6 text-left ${estRonce ? 'bg-bloom-cream' : 'bg-bloom-violet-pale'}`}>
              <p className="font-title text-lg text-bloom-black mb-2">{t('mission_secrete', lang)}</p>
              <p className="text-base text-bloom-gray-dark">{player.mission.texte}</p>
            </div>
          )}
          <button
            onClick={confirmerRole}
            disabled={player.mission_accomplie || confirmation}
            className={`min-h-[52px] text-white rounded-2xl px-6 text-base font-bold shadow-md disabled:opacity-60 mt-6 w-full ${estRonce ? 'bg-bloom-rose' : 'bg-bloom-green'}`}
          >
            {player.mission_accomplie ? t('compris', lang) : t('confirmer_role_btn', lang)}
          </button>
        </div>
      )}

      {/* ── FLEUR EN COURS ── */}
      {game?.phase === 'FLEUR_EN_COURS' && (
        <div className="w-[90%] max-w-sm mx-auto flex flex-col gap-4">
          {fleur && (
            <div className="bg-white rounded-2xl p-5 text-center shadow-md">
              <p className="text-5xl">{fleur.emoji}</p>
              <p className="font-title text-xl text-bloom-violet-dark mt-2">{fleur.nom}</p>
              <p className="text-sm text-bloom-violet-medium mt-1">{t('fleur_label', lang)} {(game?.fleur_index ?? 0) + 1} {t('sur_cinq', lang)}</p>
            </div>
          )}

          {player.mission && (
            <div className={`rounded-2xl p-5 shadow-md ${estRonce ? 'bg-bloom-rose-light' : 'bg-bloom-violet-pale'}`}>
              <p className="font-title text-base text-bloom-black mb-2">{t('ta_mission', lang)}</p>
              <p className="text-base text-bloom-gray-dark">{player.mission.texte}</p>
            </div>
          )}

          {/* Joueur éliminé : lecture seule */}
          {estElimne ? (
            <div className="bg-bloom-rose-light rounded-2xl p-5 text-center shadow-md">
              <p className="text-3xl">🥀</p>
              <p className="text-base font-bold text-bloom-gray-dark mt-2">{t('elimine_mission', lang)}</p>
            </div>
          ) : !missionSignalee ? (
            <div className="flex flex-col gap-3">
              <button onClick={() => signalerMission('reussi')} className="w-full min-h-[72px] bg-bloom-green text-white rounded-2xl px-6 text-lg font-bold shadow-md">
                {t('mission_reussie_btn', lang)}
              </button>
              <button onClick={() => signalerMission('echec')} className="w-full min-h-[72px] bg-bloom-rose text-white rounded-2xl px-6 text-lg font-bold shadow-md">
                {t('mission_echec_btn', lang)}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 text-center shadow-md">
              <p className="text-4xl">✓</p>
              <p className="font-title text-lg text-bloom-violet-dark mt-2">{t('reponse_enregistree', lang)}</p>
              <p className="text-sm text-bloom-violet-medium mt-1">{t('en_attente_resultat', lang)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── CONSÉQUENCES ── */}
      {game?.phase === 'CONSEQUENCES' && (
        <div className="w-[90%] max-w-sm mx-auto bg-white rounded-2xl p-6 shadow-md text-center">
          <p className="text-5xl animate-pulse">⏳</p>
          <p className="font-title text-xl text-bloom-violet-dark mt-4">{t('ga_prepare', lang)}</p>
        </div>
      )}

      {/* ── VOTE ── */}
      {game?.phase === 'VOTE' && (
        <div className="w-[90%] max-w-sm mx-auto flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-5 text-center shadow-md">
            <p className="text-4xl">🗳️</p>
            <p className="font-title text-xl text-bloom-violet-dark mt-2">{t('phase_vote', lang)}</p>
            <p className="text-sm text-bloom-violet-medium mt-1">{t('designe_suspect', lang)}</p>
          </div>

          {estElimne ? (
            <div className="bg-bloom-rose-light rounded-2xl p-5 text-center shadow-md">
              <p className="text-3xl">🥀</p>
              <p className="text-base font-bold text-bloom-gray-dark mt-2">{t('elimine_vote', lang)}</p>
            </div>
          ) : !game?.vote_lance ? (
            <div className="bg-white rounded-2xl p-5 text-center shadow-md">
              <p className="text-5xl animate-pulse">⏳</p>
              <p className="font-title text-lg text-bloom-violet-dark mt-3">{t('ga_lance_vote', lang)}</p>
            </div>
          ) : !aVote ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-bloom-violet-medium text-center">{t('tap_suspect', lang)}</p>
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
              <p className="font-title text-lg text-bloom-violet-dark mt-2">{t('vote_enregistre', lang)}</p>
              <p className="text-sm text-bloom-violet-medium mt-1">{t('en_attente_autres', lang)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── FIN ── */}
      {game?.phase === 'FIN' && (
        <div className="w-[90%] max-w-sm mx-auto flex flex-col gap-4 pb-6">
          {/* Bannière victoire */}
          <div className={`rounded-2xl p-6 text-center shadow-md ${game.vainqueur === 'jardiniers' ? 'bg-bloom-green-light' : 'bg-bloom-rose-light'}`}>
            <p className="text-6xl">{game.vainqueur === 'jardiniers' ? '🌸' : '🥀'}</p>
            <p className="font-title text-2xl text-bloom-black mt-3">
              {game.vainqueur === 'jardiniers' ? t('victoire_jardiniers', lang) : t('victoire_ronces', lang)}
            </p>
            <p className="text-bloom-gray-dark text-sm mt-2">
              {game.vainqueur === 'jardiniers' ? t('sous_titre_jardiniers', lang) : t('sous_titre_ronces', lang)}
            </p>
          </div>

          {/* Ton rôle */}
          <div className={`rounded-2xl p-4 text-center shadow-md ${estRonce ? 'bg-bloom-rose-light' : 'bg-bloom-green-light'}`}>
            <p className="text-3xl">{estRonce ? '🥀' : '🌸'}</p>
            <p className="font-title text-base text-bloom-black mt-1">
              {t('tu_etais', lang)} {estRonce ? t('role_ronce', lang) : t('role_jardinier', lang)}
            </p>
          </div>

          {/* Liste complète des rôles */}
          {joueurs.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-md">
              <h3 className="font-title text-base text-bloom-violet-dark mb-3">{t('fin_roles_reveles', lang)}</h3>
              <div className="flex flex-col gap-2">
                {joueurs.map(j => (
                  <div
                    key={j.id}
                    className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${j.role === 'ronce' ? 'bg-bloom-rose-light' : 'bg-bloom-green-light'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{j.role === 'ronce' ? '🥀' : '🌸'}</span>
                      <span className="text-sm font-bold text-bloom-black">{j.pseudo}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-bloom-gray-dark">{j.role === 'ronce' ? t('role_ronce', lang) : t('role_jardinier', lang)}</span>
                      {j.elimine && (
                        <span className="text-xs bg-bloom-rose text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">{t('badge_demasque', lang)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-sm text-bloom-violet-medium">{t('fin_merci', lang)}</p>
        </div>
      )}
    </main>
  )
}
