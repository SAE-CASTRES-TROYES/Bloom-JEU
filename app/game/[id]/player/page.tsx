'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import { FLEURS, FLEUR_ILLUS } from '@/lib/game'
import { t } from '@/lib/translations'
import { useLang } from '@/app/providers'

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>()
  const { lang } = useLang()
  const router = useRouter()
  const [player, setPlayer]         = useState<any>(null)
  const [game, setGame]             = useState<any>(null)
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [confirmation, setConfirmation]       = useState(false)
  const [missionSignalee, setMissionSignalee] = useState(false)
  const [aVote, setAVote]                     = useState(false)
  const [voteSubmitting, setVoteSubmitting]   = useState(false)

  useEffect(() => {
    const playerId = sessionStorage.getItem(`player_id_${id}`)

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

  useEffect(() => {
    setMissionSignalee(false)
    setAVote(false)
  }, [game?.fleur_index])

  // Fin de partie : on enregistre le résultat pour le compte connecté (une seule
  // fois par partie). record_game_result n'agit que si auth.uid() existe → un
  // invité non connecté est ignoré côté serveur. Si le RPC n'existe pas encore
  // (migration 003 non appliquée), on log sans casser la partie.
  useEffect(() => {
    if (game?.phase !== 'FIN' || !game?.vainqueur) return
    if (player?.role !== 'ronce' && player?.role !== 'jardinier') return
    const flag = `stats_recorded_${id}`
    if (sessionStorage.getItem(flag)) return
    sessionStorage.setItem(flag, '1')
    const won =
      (game.vainqueur === 'jardiniers' && player.role === 'jardinier') ||
      (game.vainqueur === 'ronces' && player.role === 'ronce')
    supabase.rpc('record_game_result', { p_won: won }).then(({ error }) => {
      if (error) {
        console.warn('record_game_result:', error.message)
        sessionStorage.removeItem(flag)
      }
    })
  }, [game?.phase, game?.vainqueur, player?.role, id])

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

  if (loading) {
    return (
      <main className="bloom-bg min-h-screen flex items-center justify-center px-5">
        <p className="font-title text-xl text-bloom-violet-dark">{t('chargement', lang)}</p>
      </main>
    )
  }

  if (!player) {
    return (
      <main className="bloom-bg min-h-screen flex flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-lg text-bloom-rose font-bold">{t('joueur_introuvable', lang)}</p>
        <p className="text-base text-bloom-gray-dark">{t('rejoindre_accueil', lang)}</p>
      </main>
    )
  }

  const estRonce   = player.role === 'ronce'
  const estElimine  = !!player.elimine
  const bgClass    = estRonce ? 'bloom-bg-ronce' : 'bloom-bg'

  if (estElimine) {
    return (
      <main className={`h-dvh ${bgClass} flex flex-col items-center justify-center px-8 text-center`}>
        <div className="w-full max-w-xs flex flex-col items-center gap-4">
          <p className="font-title text-3xl text-bloom-violet-dark leading-tight">
            {t('elimine_modal_titre', lang)}
          </p>
          <p className="text-base text-bloom-violet-medium">
            {t('elimine_modal_desc', lang)}
          </p>
          <button
            onClick={() => router.push('/')}
            className="btn-rose w-full mt-4"
          >
            {t('retour_accueil_btn', lang)}
          </button>
        </div>
      </main>
    )
  }

  const fleurIndex     = game?.fleur_index ?? 0
  const fleur          = game?.fleur_index !== undefined ? FLEURS[fleurIndex] : null
  const suspects       = allPlayers.filter(p => p.id !== player.id && p.role !== 'grand_arbre' && !p.elimine)
  const joueurs        = allPlayers.filter(p => p.role !== 'grand_arbre' && p.role)
  const isFleurEnCours = game?.phase === 'FLEUR_EN_COURS'

  const roleBadge = player.role ? (
    <span className={`inline-block mt-2 text-xs font-bold px-3 py-0.5 rounded-full ${
      estRonce ? 'bg-bloom-rose text-white' : 'bg-bloom-green text-white'
    }`}>
      {estRonce ? t('role_ronce', lang) : t('role_jardinier', lang)}
    </span>
  ) : null

  return (
    <main className={`h-dvh overflow-hidden ${bgClass} flex flex-col items-center px-5`}>

      {/* Bouton accueil fixe */}
      <button
        onClick={() => router.push('/')}
        className="fixed top-4 left-4 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-bloom-violet-pale text-bloom-violet-dark shadow-sm"
        aria-label="Accueil"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 12L12 3l9 9"/><path d="M5 10v9h5v-5h4v5h5v-9"/>
        </svg>
      </button>

      {/* ── FLEUR EN COURS : header fixe + layout vh ── */}
      {isFleurEnCours && (
        <>
        <div className="w-full max-w-sm pt-4 pb-2 text-center shrink-0">
          <h1 className="font-title text-4xl font-bold text-bloom-violet-dark leading-tight break-words">
            {player.pseudo}
          </h1>
          {roleBadge}
        </div>
        </>
      )}
      {isFleurEnCours && (
        <div className="flex-1 min-h-0 w-full max-w-sm flex flex-col">

          {/* Zone illustration : ~38vh */}
          <div
            className="shrink-0 flex flex-col items-center justify-end"
            style={{ height: '38vh' }}
          >
            {fleur && FLEUR_ILLUS[fleurIndex] && (
              <Image
                src={FLEUR_ILLUS[fleurIndex].eclos}
                alt={fleur.nom}
                width={300}
                height={300}
                className="object-contain"
                style={{ maxHeight: 'calc(38vh - 3.5rem)', maxWidth: '100%', width: 'auto', height: 'auto' }}
              />
            )}
            {fleur && (
              <>
                <p className="font-title text-xl text-bloom-violet-dark mt-1 leading-tight">{fleur.nom}</p>
                <p className="text-xs text-bloom-violet-medium mt-0.5">
                  {t('fleur_label', lang)} {fleurIndex + 1} {t('sur_cinq', lang)}
                </p>
              </>
            )}
          </div>

          {/* Zone mission + boutons : reste de l'espace, défilable si besoin */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pt-3 pb-24">

            {player.mission && (
              <div className={`w-full p-4 ${estRonce ? 'card-ronce' : 'card-bloom'}`}>
                <p className="font-title text-sm text-bloom-black mb-1">{t('ta_mission', lang)}</p>
                <p className="text-sm text-bloom-gray-dark">{player.mission.texte}</p>
              </div>
            )}

            {estElimine ? (
              <div className="card-ronce p-4 w-full text-center">
                <p className="text-sm font-bold text-bloom-gray-dark">{t('elimine_mission', lang)}</p>
              </div>
            ) : !missionSignalee ? (
              <div className="flex flex-col gap-3 w-full">
                <button onClick={() => signalerMission('reussi')} className="btn-green w-full min-h-[56px] text-base">
                  {t('mission_reussie_btn', lang)}
                </button>
                <button onClick={() => signalerMission('echec')} className="btn-rose w-full min-h-[56px] text-base">
                  {t('mission_echec_btn', lang)}
                </button>
              </div>
            ) : (
              <div className="card-bloom p-4 w-full text-center">
                <p className="font-title text-base text-bloom-violet-dark">{t('reponse_enregistree', lang)}</p>
                <p className="text-sm text-bloom-violet-medium mt-1">{t('en_attente_resultat', lang)}</p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Toutes les autres phases : centré verticalement ── */}
      {!isFleurEnCours && (
        <div className="flex-1 min-h-0 overflow-y-auto w-full max-w-sm">
          <div className="min-h-full flex flex-col items-center justify-center gap-4 py-8 pb-24">

            {/* Pseudo + badge, intégrés dans le bloc centré */}
            <div className="text-center">
              <h1 className="font-title text-4xl font-bold text-bloom-violet-dark leading-tight break-words">
                {player.pseudo}
              </h1>
              {roleBadge}
            </div>

            {/* LOBBY */}
            {game?.phase === 'LOBBY' && (
              <div className="card-bloom p-6 w-full text-center">
                <p className="font-title text-xl text-bloom-violet-dark">{t('en_attente_ga', lang)}</p>
                <p className="text-base text-bloom-violet-medium mt-2">{t('partie_bientot', lang)}</p>
              </div>
            )}

            {/* ROLE */}
            {game?.phase === 'ROLE' && player.role && (
              <div className={`w-full p-6 text-center ${estRonce ? 'card-ronce' : 'card-jardinier'}`}>
                <p className="font-title text-3xl text-bloom-black mb-3">
                  {estRonce ? t('role_ronce', lang) : t('role_jardinier', lang)}
                </p>
                <p className="text-base text-bloom-gray-dark">
                  {estRonce ? t('role_ronce_desc', lang) : t('role_jardinier_desc', lang)}
                </p>
                {player.mission && (
                  <div className={`rounded-xl p-4 mt-5 text-left ${estRonce ? 'bg-bloom-cream' : 'bg-bloom-violet-pale'}`}>
                    <p className="font-title text-base text-bloom-black mb-1">{t('mission_secrete', lang)}</p>
                    <p className="text-base text-bloom-gray-dark">{player.mission.texte}</p>
                  </div>
                )}
                <button
                  onClick={confirmerRole}
                  disabled={player.mission_accomplie || confirmation}
                  className={`mt-5 w-full ${estRonce ? 'btn-rose' : 'btn-green'}`}
                >
                  {player.mission_accomplie ? t('compris', lang) : t('confirmer_role_btn', lang)}
                </button>
              </div>
            )}

            {/* CONSEQUENCES */}
            {game?.phase === 'CONSEQUENCES' && (
              <div className="card-bloom p-6 w-full text-center">
                <p className="font-title text-xl text-bloom-violet-dark">{t('ga_prepare', lang)}</p>
              </div>
            )}

            {/* VOTE */}
            {game?.phase === 'VOTE' && (
              <>
                <div className="card-bloom p-5 w-full text-center">
                  <p className="font-title text-xl text-bloom-violet-dark">{t('phase_vote', lang)}</p>
                  <p className="text-sm text-bloom-violet-medium mt-1">{t('designe_suspect', lang)}</p>
                </div>

                {estElimine ? (
                  <div className="card-ronce p-5 w-full text-center">
                    <p className="text-base font-bold text-bloom-gray-dark">{t('elimine_vote', lang)}</p>
                  </div>
                ) : !game?.vote_lance ? (
                  <div className="card-bloom p-5 w-full text-center">
                    <p className="font-title text-lg text-bloom-violet-dark">{t('ga_lance_vote', lang)}</p>
                  </div>
                ) : !aVote ? (
                  <div className="flex flex-col gap-3 w-full">
                    <p className="text-sm text-bloom-violet-medium text-center">{t('tap_suspect', lang)}</p>
                    {suspects.map(s => (
                      <button
                        key={s.id}
                        onClick={() => soumettreVote(s.id)}
                        disabled={voteSubmitting}
                        className="btn-ghost w-full min-h-[64px] justify-start px-5"
                      >
                        <span className="truncate">{s.pseudo}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="card-bloom p-6 w-full text-center">
                    <p className="font-title text-lg text-bloom-violet-dark">{t('vote_enregistre', lang)}</p>
                    <p className="text-sm text-bloom-violet-medium mt-1">{t('en_attente_autres', lang)}</p>
                  </div>
                )}
              </>
            )}

            {/* FIN */}
            {game?.phase === 'FIN' && (
              <>
                <div className={`w-full p-6 text-center rounded-2xl ${
                  game.vainqueur === 'jardiniers' ? 'card-jardinier' : 'card-ronce'
                }`}>
                  <p className="font-title text-2xl text-bloom-black">
                    {game.vainqueur === 'jardiniers' ? t('victoire_jardiniers', lang) : t('victoire_ronces', lang)}
                  </p>
                  <p className="text-bloom-gray-dark text-sm mt-2">
                    {game.vainqueur === 'jardiniers' ? t('sous_titre_jardiniers', lang) : t('sous_titre_ronces', lang)}
                  </p>
                </div>

                <div className={`w-full p-4 text-center rounded-2xl ${estRonce ? 'card-ronce' : 'card-jardinier'}`}>
                  <p className="font-title text-base text-bloom-black">
                    {t('tu_etais', lang)} {estRonce ? t('role_ronce', lang) : t('role_jardinier', lang)}
                  </p>
                </div>

                {joueurs.length > 0 && (
                  <div className="card-bloom p-4 w-full">
                    <h3 className="font-title text-base text-bloom-violet-dark mb-3">{t('fin_roles_reveles', lang)}</h3>
                    <div className="flex flex-col gap-2">
                      {joueurs.map(j => (
                        <div
                          key={j.id}
                          className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${
                            j.role === 'ronce' ? 'bg-bloom-rose-light' : 'bg-bloom-green-light'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${j.role === 'ronce' ? 'bg-bloom-rose' : 'bg-bloom-green'}`} />
                            <span className="text-sm font-bold text-bloom-black">{j.pseudo}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-bloom-gray-dark">
                              {j.role === 'ronce' ? t('role_ronce', lang) : t('role_jardinier', lang)}
                            </span>
                            {j.elimine && (
                              <span className="text-xs bg-bloom-rose text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                {t('badge_demasque', lang)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-center text-sm text-bloom-violet-medium">{t('fin_merci', lang)}</p>
              </>
            )}

          </div>
        </div>
      )}

    </main>
  )
}
