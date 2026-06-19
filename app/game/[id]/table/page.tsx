'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { construireDeck, distribuerRoles, tirerMission, ajusterFleur, FLEURS, FLEUR_CONFIGS, CARTE_INFO, FLEUR_ILLUS } from '@/lib/game'
import type { ModificateurActif } from '@/lib/game'
import { t } from '@/lib/translations'
import { useLang } from '@/app/providers'

const RESOURCE_ILLUS: Record<string, string> = {
  eau:    '/illustrations/eau.png',
  soleil: '/illustrations/soleil.png',
  vent:   '/illustrations/vent.png',
  terre:  '/illustrations/terre.png',
}


export default function TablePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [game, setGame]       = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [votes, setVotes]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lancement, setLancement] = useState(false)
  const { lang } = useLang()

  const [resultatVote, setResultatVote] = useState<{ egalite: boolean; vainqueur?: any; nbVotes?: number } | null>(null)
  const [joueurRevele, setJoueurRevele] = useState<{ joueur: any; role: string } | null>(null)


  const transitionLancee = useRef(false)

  useEffect(() => {
    async function load() {
      const { data: g } = await supabase.from('games').select().eq('id', id).single()
      setGame(g)
      const { data: p } = await supabase.from('players').select().eq('game_id', id)
      setPlayers(p || [])
      setLoading(false)
    }
    load()

    const playersChannel = supabase
      .channel(`players-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${id}` }, (payload) => {
        setPlayers(prev => prev.some(p => p.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `game_id=eq.${id}` }, (payload) => {
        setPlayers(prev => prev.map(p => p.id === payload.new.id ? payload.new : p))
      })
      .subscribe()

    const gameChannel = supabase
      .channel(`game-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, (payload) => {
        setGame(payload.new)
      })
      .subscribe()

    const votesChannel = supabase
      .channel(`votes-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `game_id=eq.${id}` }, (payload) => {
        setVotes(prev => prev.some(v => v.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(playersChannel)
      supabase.removeChannel(gameChannel)
      supabase.removeChannel(votesChannel)
    }
  }, [id])

  useEffect(() => {
    if (game?.phase !== 'VOTE') return
    setResultatVote(null)
    setJoueurRevele(null)
    supabase
      .from('votes')
      .select()
      .eq('game_id', id)
      .eq('fleur_index', game.fleur_index ?? 0)
      .then(({ data }) => { if (data) setVotes(data) })
  }, [id, game?.phase, game?.fleur_index])

  const joueurs       = players.filter(p => p.role !== 'grand_arbre')
  const joueurActifs  = joueurs.filter(j => !j.elimine)
  const tousConnectes = !!game && joueurs.length === game.nb_joueurs
  const nbConfirmes   = joueurs.filter(p => p.mission_accomplie).length
  const tousConfirmes = !!game && joueurs.length === game.nb_joueurs && nbConfirmes === joueurs.length
  const nbMissionsSignalees = joueurActifs.filter(j => j.mission_resultat != null).length
  const nbMissionsReussies  = joueurActifs.filter(j => j.mission_resultat === 'reussi').length

  const fleurIndex  = game?.fleur_index ?? 0
  const fleur       = FLEURS[fleurIndex]
  const fleurConfig = game ? FLEUR_CONFIGS[fleurIndex]?.[game.nb_joueurs] : undefined
  const requis      = fleurConfig?.requis
  const votesFleur  = votes.filter(v => v.fleur_index === fleurIndex)

  // Modificateurs reportés depuis la fleur précédente (missions réussies).
  const modsActifs: ModificateurActif[] = (game?.modificateurs_actifs as ModificateurActif[] | undefined) ?? []
  const requisTotalBase = requis ? (Object.values(requis) as number[]).reduce((a, b) => a + b, 0) : 0
  const ajust = ajusterFleur(fleurConfig?.qn ?? 0, requisTotalBase, modsActifs)

  // Modificateurs qui s'appliqueront à la PROCHAINE fleur (missions réussies de la fleur courante).
  function collecterModificateurs(): ModificateurActif[] {
    return joueurActifs
      .filter(j => j.mission_resultat === 'reussi' && j.mission?.effet && (j.role === 'jardinier' || j.role === 'ronce'))
      .map(j => ({ role: j.role, texte: j.mission.modificateur, effet: j.mission.effet }))
  }

  useEffect(() => {
    if (game?.phase !== 'ROLE') { transitionLancee.current = false; return }
    if (tousConfirmes && !transitionLancee.current) {
      transitionLancee.current = true
      supabase.from('games').update({ phase: 'FLEUR_EN_COURS', fleur_index: 0 }).eq('id', id)
        .then(({ error }) => { if (error) { console.error(error); transitionLancee.current = false } })
    }
  }, [game?.phase, tousConfirmes, id])

  async function lancerPartie() {
    if (!game) return
    const deck = construireDeck()
    setLancement(true)

    const roles = distribuerRoles(joueurs.map(j => j.id), game.nb_joueurs)
    let pioche = deck

    const updates = joueurs.map(j => {
      const role = roles[j.id]
      const main = pioche.slice(0, 4)
      pioche = pioche.slice(4)
      const mission = tirerMission(role)
      return supabase.from('players').update({ role, main, mission, mission_accomplie: false }).eq('id', j.id)
    })

    const resultats = await Promise.all(updates)
    if (resultats.find(r => r.error)) { setLancement(false); return }

    const { data, error } = await supabase.from('games').update({ phase: 'ROLE' }).eq('id', id).select().single()
    if (error) { console.error(error); setLancement(false); return }
    setGame(data)
    setLancement(false)
  }

  async function signalerResultat(resultat: 'eclose' | 'fanee') {
    const nouvEcloses = (game?.fleurs_ecloses ?? 0) + (resultat === 'eclose' ? 1 : 0)
    const nouvFanees  = (game?.fleurs_fanees  ?? 0) + (resultat === 'fanee'  ? 1 : 0)

    let vainqueur: 'jardiniers' | 'ronces' | null = null
    if (nouvFanees >= 3) vainqueur = 'ronces'
    else if (nouvEcloses >= 3) vainqueur = 'jardiniers'

    if (vainqueur) {
      await supabase.from('games').update({
        phase: 'FIN', vainqueur,
        resultat_fleur: resultat,
        fleurs_ecloses: nouvEcloses,
        fleurs_fanees: nouvFanees,
      }).eq('id', id)
      return
    }

    await supabase.from('games').update({
      phase: 'CONSEQUENCES',
      resultat_fleur: resultat,
      fleurs_ecloses: nouvEcloses,
      fleurs_fanees: nouvFanees,
    }).eq('id', id)
  }

  async function avancerVersFleur(nextIndex: number) {
    // Reporte les modificateurs des missions RÉUSSIES vers la prochaine fleur
    // (avant le reset des missions, sinon mission_resultat est effacé).
    const mods = collecterModificateurs()

    // On re-tire une mission pour chaque joueur à chaque fleur (sinon la mission
    // reste identique toute la partie). Le rôle, lui, ne change pas.
    await Promise.all(joueurs.map(j =>
      supabase.from('players').update({ mission_resultat: null, mission: tirerMission(j.role) }).eq('id', j.id)
    ))
    setResultatVote(null)
    setJoueurRevele(null)

    if (nextIndex >= 5) {
      const vainqueur = (game?.fleurs_ecloses ?? 0) >= 3 ? 'jardiniers'
        : (game?.fleurs_fanees ?? 0) >= 3 ? 'ronces'
        : null
      await supabase.from('games').update({ phase: 'FIN', vainqueur }).eq('id', id)
      return
    }

    const payload = {
      phase: 'FLEUR_EN_COURS',
      fleur_index: nextIndex,
      resultat_fleur: null,
      vote_lance: false,
    }
    const { error } = await supabase.from('games').update({ ...payload, modificateurs_actifs: mods }).eq('id', id)
    if (error) {
      // Fallback si la colonne modificateurs_actifs n'existe pas encore (migration 004 non appliquée).
      await supabase.from('games').update(payload).eq('id', id)
    }
  }

  async function continuerApresCons() {
    if (fleurIndex === 0) {
      await avancerVersFleur(1)
    } else {
      await supabase.from('games').update({ phase: 'VOTE' }).eq('id', id)
    }
  }

  async function lancerVote() {
    await supabase.from('games').update({ vote_lance: true }).eq('id', id)
  }

  function voirResultatVote() {
    if (votesFleur.length === 0) { setResultatVote({ egalite: true }); return }
    const comptage: Record<string, number> = {}
    votesFleur.forEach(v => { comptage[v.suspect_id] = (comptage[v.suspect_id] || 0) + 1 })
    const max = Math.max(...Object.values(comptage))
    const gagnants = Object.keys(comptage).filter(sid => comptage[sid] === max)
    if (gagnants.length > 1) {
      setResultatVote({ egalite: true })
    } else {
      const vainqueur = players.find(p => p.id === gagnants[0])
      setResultatVote({ egalite: false, vainqueur, nbVotes: max })
    }
  }

  async function revelerRole(joueur: any) {
    await supabase.from('players').update({ elimine: true }).eq('id', joueur.id)

    // React state pas encore mis à jour — on exclut manuellement le joueur éliminé à l'instant
    const roncesRestantes    = joueurs.filter(j => j.role === 'ronce'      && !j.elimine && j.id !== joueur.id).length
    const jardiniersRestants = joueurs.filter(j => j.role === 'jardinier'  && !j.elimine && j.id !== joueur.id).length

    // Toutes les Ronces éliminées → Jardiniers gagnent
    if (joueur.role === 'ronce' && roncesRestantes === 0) {
      await supabase.from('games').update({ phase: 'FIN', vainqueur: 'jardiniers' }).eq('id', id)
      return
    }

    // Jardiniers moins nombreux que Ronces restantes → Ronces gagnent
    if (jardiniersRestants < roncesRestantes) {
      await supabase.from('games').update({ phase: 'FIN', vainqueur: 'ronces' }).eq('id', id)
      return
    }

    setJoueurRevele({ joueur, role: joueur.role })
  }

  if (loading) {
    return (
      <main className="bloom-bg min-h-screen flex items-center justify-center px-5">
        <p className="font-title text-2xl text-bloom-violet-dark">{t('chargement', lang)}</p>
      </main>
    )
  }

  return (
    <main className="bloom-bg min-h-screen relative">

      {/* Navigation fixe */}
      <button
        onClick={() => router.push('/')}
        className="fixed top-4 left-4 z-10 flex items-center justify-center w-12 h-12 rounded-full bg-bloom-violet-pale text-bloom-violet-dark shadow-sm"
        aria-label="Accueil"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 12L12 3l9 9"/><path d="M5 10v9h5v-5h4v5h5v-9"/>
        </svg>
      </button>

      {/* Badge score (hors LOBBY) */}
      {game?.phase !== 'LOBBY' && (
        <div className="fixed top-3 right-3 flex gap-1.5 z-50">
          <div className="score-badge">
            <span className="w-2.5 h-2.5 rounded-full bg-bloom-green shrink-0" />
            <span className="font-body text-sm font-bold text-bloom-gold">{game?.fleurs_ecloses ?? 0}</span>
          </div>
          <div className="score-badge">
            <span className="w-2.5 h-2.5 rounded-full bg-bloom-rose shrink-0" />
            <span className="font-body text-sm font-bold text-bloom-gold">{game?.fleurs_fanees ?? 0}</span>
          </div>
        </div>
      )}

      {/* ── LOBBY : layout centré pleine page, logo inclus dans le groupe ── */}
      {game?.phase === 'LOBBY' && (
        <div className="min-h-screen flex flex-col items-center px-5 pt-[5vh] pb-24 overflow-y-auto">
          <div className="w-full max-w-lg flex flex-col items-center gap-2">

            <Image src="/logo-baseline.png" alt="BLOOM" width={176} height={64} className="w-36 md:w-44 h-auto opacity-90 mb-1" />

            <div className="relative w-full h-[40vh] md:h-[50vh] lg:h-[55vh]">
              <Image
                src="/illustrations/grand-arbre.png"
                alt="Le Grand Arbre"
                fill
                className="object-contain"
                style={{ objectPosition: 'bottom center' }}
              />
            </div>

            <div className="card-bloom p-4 w-full text-center">
              <p className="text-bloom-violet-dark text-base">{t('code_partie', lang)}</p>
              <p className="font-title tracking-widest text-bloom-gold text-4xl sm:text-5xl mt-0.5">{game?.code}</p>
              <p className="text-bloom-violet-dark text-base mt-1">{t('joueurs_rejoignent', lang)}</p>
            </div>

            <div className="card-bloom p-4 w-full">
              <h2 className="font-title text-lg mb-2 text-bloom-violet-dark">
                {t('joueurs_connectes', lang)} ({joueurs.length}/{game?.nb_joueurs})
              </h2>
              <div className="flex flex-col gap-2">
                {joueurs.map(p => (
                  <div key={p.id} className="bg-bloom-violet-pale/40 rounded-xl px-4 py-3 text-base text-bloom-gray-dark">
                    {p.pseudo}
                  </div>
                ))}
              </div>
            </div>

            {tousConnectes && (
              <button
                onClick={lancerPartie}
                disabled={lancement}
                className="btn-bloom w-full text-lg"
              >
                {t('lancer_partie', lang)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Autres phases : logo ancré en haut, contenu centré en dessous ── */}
      {game?.phase !== 'LOBBY' && (
      <div className="flex flex-col items-center px-5 min-h-screen">

      {/* Logo */}
      <div className="pt-10 pb-3 flex justify-center w-full">
        <Image src="/logo-baseline.png" alt="BLOOM" width={176} height={64} className="w-44 h-auto opacity-90" />
      </div>

      {/* Contenu de phase — centré dans l'espace restant */}
      <div className="flex-1 w-full max-w-lg mx-auto flex flex-col items-center justify-center gap-4 pb-8">

        {/* ROLE */}
        {game?.phase === 'ROLE' && (
          <div className="card-bloom p-6 w-full text-center">
            <p className="font-title text-2xl text-bloom-violet-dark mb-4">{t('distribution_roles', lang)}</p>
            <p className="text-lg text-bloom-gold">{nbConfirmes} / {game?.nb_joueurs} {t('ont_confirme', lang)}</p>
            <div className="flex flex-col gap-2 mt-5">
              {joueurs.map(p => (
                <div key={p.id} className="bg-bloom-violet-pale/40 rounded-xl px-4 py-3 text-base flex justify-between items-center text-bloom-gray-dark">
                  <span>{p.pseudo}</span>
                  <span className={`text-sm font-bold ${p.mission_accomplie ? 'text-bloom-green' : 'text-bloom-violet-dark opacity-50'}`}>
                    {p.mission_accomplie ? '✓' : '...'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FLEUR EN COURS */}
        {game?.phase === 'FLEUR_EN_COURS' && fleur && (
          <>
            <div className="w-full text-center">
              {FLEUR_ILLUS[fleurIndex] && (
                <Image
                  src={FLEUR_ILLUS[fleurIndex].eclos}
                  alt={fleur.nom}
                  width={300}
                  height={300}
                  className="mx-auto mb-3 object-contain"
                />
              )}
              <h2 className="font-title text-3xl text-bloom-violet-dark">{fleur.nom}</h2>
              <p className="text-bloom-violet-medium text-sm mt-1">
                {t('fleur_label', lang)} {fleurIndex + 1} {t('sur_cinq', lang)}
              </p>
            </div>

            {modsActifs.length > 0 && (
              <div className="card-bloom p-4 w-full border-2 border-bloom-gold/60">
                <p className="font-title text-sm text-bloom-violet-dark mb-2">{t('mod_actifs_titre', lang)}</p>
                <ul className="flex flex-col gap-2 text-left">
                  {modsActifs.map((m, i) => (
                    <li key={i} className="text-sm text-bloom-gray-dark flex gap-2">
                      <span className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${m.role === 'ronce' ? 'bg-bloom-rose' : 'bg-bloom-green'}`} />
                      <span>{m.texte}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {requis && (
              <div className="card-bloom p-5 w-full">
                <h3 className="font-title text-lg text-bloom-violet-dark mb-4">{t('ressources_requises', lang)}</h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
                  {(Object.entries(requis) as [string, number][])
                    .filter(([, n]) => n > 0)
                    .map(([res, n]) => {
                      const info  = CARTE_INFO[res]
                      const illus = RESOURCE_ILLUS[res]
                      return (
                        <div key={res} className="flex flex-col items-center gap-2">
                          <div className="w-24 h-24 flex items-center justify-center">
                            {illus ? (
                              <Image
                                src={illus}
                                alt={info?.label ?? res}
                                width={96}
                                height={96}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span
                                className="w-10 h-10 rounded-full"
                                style={{ backgroundColor: info?.couleur ?? '#ccc' }}
                              />
                            )}
                          </div>
                          <p className="font-title text-xl text-bloom-black text-center leading-tight">{n}× {info?.label}</p>
                        </div>
                      )
                    })}
                </div>
                {ajust.requisModifie && (
                  <p className="text-bloom-violet-medium text-sm mt-3">
                    {t('ressources_requises', lang)} : {ajust.requisTotal} <span className="font-normal">{t('modifie', lang)}</span>
                  </p>
                )}
                {fleurConfig && (
                  <p className="text-bloom-rose text-base font-semibold mt-4">
                    {t('max_effets', lang)} {ajust.qn} {t('effets_neg_toleres', lang)}
                    {ajust.qnModifie && <span className="text-bloom-violet-medium font-normal"> {t('modifie', lang)}</span>}
                  </p>
                )}
              </div>
            )}

            <div className="card-bloom p-4 w-full text-center">
              <p className="text-bloom-violet-medium text-sm">{t('missions_signalees', lang)}</p>
              <p className="font-title text-3xl text-bloom-gold mt-1">
                {nbMissionsSignalees} / {joueurActifs.length}
              </p>
            </div>

            <button onClick={() => signalerResultat('eclose')} className="btn-green w-full min-h-[68px] text-lg">
              {t('bouton_eclose', lang)}
            </button>
            <button onClick={() => signalerResultat('fanee')} className="btn-rose w-full min-h-[68px] text-lg">
              {t('bouton_fanee', lang)}
            </button>
          </>
        )}

        {/* CONSEQUENCES */}
        {game?.phase === 'CONSEQUENCES' && (
          <>
            <div className={`w-full rounded-2xl p-5 sm:p-8 text-center card-bloom ${
              game.resultat_fleur === 'eclose'
                ? 'border-bloom-green/40'
                : 'border-bloom-rose/40'
            }`}>
              {FLEUR_ILLUS[fleurIndex] && (
                <Image
                  src={game.resultat_fleur === 'fanee'
                    ? FLEUR_ILLUS[fleurIndex].fane
                    : FLEUR_ILLUS[fleurIndex].eclos}
                  alt={fleur?.nom ?? ''}
                  width={220}
                  height={220}
                  className="mx-auto mb-4 object-contain"
                />
              )}
              <p className="font-title text-3xl text-bloom-violet-dark">
                {game.resultat_fleur === 'eclose' ? t('fleur_eclose_titre', lang) : t('fleur_fanee_titre', lang)}
              </p>
              <div className={`mt-3 inline-block w-12 h-1 rounded-full ${
                game.resultat_fleur === 'eclose' ? 'bg-bloom-green' : 'bg-bloom-rose'
              }`} />
            </div>

            <div className="card-bloom p-5 w-full text-center">
              <p className="font-title text-4xl text-bloom-gold">{nbMissionsReussies}</p>
              <p className="text-bloom-violet-medium mt-1">
                {t('mission_s', lang)} {t('accomplie_s', lang)} {t('sur', lang)} {joueurActifs.length}
              </p>
            </div>

            {(() => {
              const aVenir = collecterModificateurs()
              return (
                <div className="card-bloom p-4 w-full">
                  <p className="text-sm text-bloom-violet-medium text-center">{t('modificateurs', lang)}</p>
                  {aVenir.length > 0 && (
                    <ul className="flex flex-col gap-2 text-left mt-3">
                      {aVenir.map((m, i) => (
                        <li key={i} className="text-sm text-bloom-gray-dark flex gap-2">
                          <span className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${m.role === 'ronce' ? 'bg-bloom-rose' : 'bg-bloom-green'}`} />
                          <span>{m.texte}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })()}

            <button onClick={continuerApresCons} className="btn-bloom w-full">
              {fleurIndex === 0 ? t('continuer', lang) : t('continuer_vote', lang)}
            </button>
          </>
        )}

        {/* VOTE */}
        {game?.phase === 'VOTE' && (
          <>
            <div className="card-bloom p-5 w-full text-center">
              <h2 className="font-title text-xl text-bloom-violet-dark">{t('phase_vote', lang)}</h2>
              <p className="text-bloom-violet-medium text-sm mt-1">{t('groupe_designe', lang)}</p>
            </div>

            {!game?.vote_lance && !resultatVote && !joueurRevele && (
              <>
                <button onClick={lancerVote} className="btn-bloom w-full min-h-[64px] text-lg">
                  {t('lancer_vote_btn', lang)}
                </button>
                <button onClick={() => avancerVersFleur(fleurIndex + 1)} className="btn-ghost w-full">
                  {t('passer_sans_voter', lang)}
                </button>
              </>
            )}

            {game?.vote_lance && !resultatVote && !joueurRevele && (
              <>
                <div className="card-bloom p-5 w-full text-center">
                  <p className="font-title text-4xl text-bloom-gold">{votesFleur.length} / {joueurActifs.length}</p>
                  <p className="text-bloom-violet-medium mt-1">{t('joueurs_ont_vote', lang)}</p>
                </div>
                <button onClick={voirResultatVote} className="btn-gold w-full">
                  {t('voir_resultats', lang)}
                </button>
              </>
            )}

            {resultatVote && !joueurRevele && (
              <>
                {resultatVote.egalite || !resultatVote.vainqueur ? (
                  <div className="card-bloom p-6 w-full text-center">
                    <p className="font-title text-xl text-bloom-violet-dark">{t('egalite_vote', lang)}</p>
                    <p className="text-sm text-bloom-violet-medium mt-1">{t('personne_designe', lang)}</p>
                  </div>
                ) : (
                  <div className="card-bloom p-6 w-full text-center">
                    <p className="font-title text-xl text-bloom-violet-dark">
                      {resultatVote.vainqueur.pseudo} {t('est_designe', lang)}
                    </p>
                    <p className="text-sm text-bloom-violet-medium mt-1">{resultatVote.nbVotes} {t('vote_s', lang)}</p>
                  </div>
                )}

                {!resultatVote.egalite && resultatVote.vainqueur && (
                  <button
                    onClick={() => revelerRole(resultatVote.vainqueur)}
                    className="btn-rose w-full min-h-[64px] text-lg"
                  >
                    {t('reveler_role_de', lang)} {resultatVote.vainqueur.pseudo}
                  </button>
                )}

                <button onClick={() => avancerVersFleur(fleurIndex + 1)} className="btn-ghost w-full">
                  {resultatVote.egalite ? t('continuer_simple', lang) : t('passer_sans_reveler', lang)}
                </button>
              </>
            )}

            {joueurRevele && (
              <>
                <div className={`w-full rounded-2xl p-5 sm:p-8 text-center ${
                  joueurRevele.role === 'ronce' ? 'card-ronce' : 'card-jardinier'
                }`}>
                  <p className="font-title text-xl sm:text-2xl text-bloom-black break-words">
                    {joueurRevele.joueur.pseudo}{' '}
                    {joueurRevele.role === 'ronce' ? t('etait_ronce_txt', lang) : t('etait_jardinier_txt', lang)}
                  </p>
                  <p className="text-sm text-bloom-gray-dark mt-2">
                    {joueurRevele.role === 'ronce' ? t('joueur_elimine_votes', lang) : t('jeu_continue', lang)}
                  </p>
                </div>
                <button onClick={() => avancerVersFleur(fleurIndex + 1)} className="btn-bloom w-full">
                  {fleurIndex >= 4 ? t('voir_resultat_final', lang) : t('fleur_suivante', lang)}
                </button>
              </>
            )}
          </>
        )}

        {/* FIN */}
        {game?.phase === 'FIN' && (
          <>
            <div className={`w-full rounded-2xl p-5 sm:p-8 text-center ${
              game.vainqueur === 'jardiniers' ? 'card-jardinier' : 'card-ronce'
            }`}>
              <p className="font-title text-3xl text-bloom-black">
                {game.vainqueur === 'jardiniers' ? t('victoire_jardiniers', lang) : t('victoire_ronces', lang)}
              </p>
              <p className="text-bloom-gray-dark text-sm mt-2">
                {game.vainqueur === 'jardiniers' ? t('sous_titre_jardiniers', lang) : t('sous_titre_ronces', lang)}
              </p>
            </div>

            <div className="card-bloom p-5 w-full flex justify-around">
              <div className="text-center">
                <p className="text-xs text-bloom-violet-medium uppercase tracking-wider">{t('fleurs_ecloses', lang)}</p>
                <p className="font-title text-4xl text-bloom-green mt-1">{game.fleurs_ecloses ?? 0}</p>
              </div>
              <div className="w-px bg-bloom-violet-dark/60" />
              <div className="text-center">
                <p className="text-xs text-bloom-violet-medium uppercase tracking-wider">{t('fleurs_fanees', lang)}</p>
                <p className="font-title text-4xl text-bloom-rose mt-1">{game.fleurs_fanees ?? 0}</p>
              </div>
            </div>

            <div className="card-bloom p-5 w-full">
              <h3 className="font-title text-lg text-bloom-violet-dark mb-3">{t('fin_roles_reveles', lang)}</h3>
              <div className="flex flex-col gap-2">
                {joueurs.map(j => (
                  <div
                    key={j.id}
                    className={`rounded-xl px-4 py-3 flex items-center justify-between ${
                      j.role === 'ronce' ? 'bg-bloom-rose/15' : 'bg-bloom-green/15'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        j.role === 'ronce' ? 'bg-bloom-rose' : 'bg-bloom-green'
                      }`} />
                      <span className="text-base font-bold text-bloom-gray-dark truncate max-w-[120px] sm:max-w-none">{j.pseudo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-bloom-violet-medium">
                        {j.role === 'ronce' ? t('role_ronce', lang) : t('role_jardinier', lang)}
                      </span>
                      {j.elimine && (
                        <span className="text-xs bg-bloom-rose text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                          {t('badge_demasque', lang)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center text-sm text-bloom-violet-medium/70">{t('fin_merci', lang)}</p>
          </>
        )}

      </div>
      </div>
      )}

    </main>
  )
}
