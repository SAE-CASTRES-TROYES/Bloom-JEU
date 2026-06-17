'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { construireDeck, distribuerRoles, tirerMission, FLEURS, FLEUR_CONFIGS, CARTE_INFO } from '@/lib/game'

export default function TablePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [game, setGame]       = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [votes, setVotes]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lancement, setLancement] = useState(false)

  // État local pour l'affichage du vote
  const [resultatVote, setResultatVote] = useState<{ egalite: boolean; vainqueur?: any; nbVotes?: number } | null>(null)
  const [joueurRevele, setJoueurRevele] = useState<{ joueur: any; role: string } | null>(null)

  const transitionFLancee = useRef(false)

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

  // Charge les votes du tour courant quand on entre en VOTE
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

  // ROLE → FLEUR_EN_COURS automatique quand tous ont confirmé
  const joueurs       = players.filter(p => p.role !== 'grand_arbre')
  const joueurActifs  = joueurs.filter(j => !j.elimine)
  const tousConnectes = !!game && joueurs.length === game.nb_joueurs
  const nbConfirmes   = joueurs.filter(p => p.mission_accomplie).length
  const tousConfirmes = !!game && joueurs.length === game.nb_joueurs && nbConfirmes === joueurs.length
  const nbMissionsSignalees = joueurs.filter(j => j.mission_resultat !== null && j.mission_resultat !== undefined).length
  const nbMissionsReussies  = joueurs.filter(j => j.mission_resultat === 'reussi').length

  useEffect(() => {
    if (game?.phase !== 'ROLE') { transitionFLancee.current = false; return }
    if (tousConfirmes && !transitionFLancee.current) {
      transitionFLancee.current = true
      supabase.from('games').update({ phase: 'FLEUR_EN_COURS', fleur_index: 0 }).eq('id', id)
        .then(({ error }) => { if (error) { console.error(error); transitionFLancee.current = false } })
    }
  }, [game?.phase, tousConfirmes, id])

  // ── Computed ──────────────────────────────────────────────────────────────
  const fleurIndex  = game?.fleur_index ?? 0
  const fleur       = FLEURS[fleurIndex]
  const fleurConfig = game ? FLEUR_CONFIGS[fleurIndex]?.[game.nb_joueurs] : undefined
  const requis      = fleurConfig?.t1

  const votesFleur = votes.filter(v => v.fleur_index === fleurIndex)

  // ── Actions ───────────────────────────────────────────────────────────────

  async function lancerPartie() {
    if (!game) return
    const deck = construireDeck(game.nb_joueurs)
    if (!deck) { alert(`Deck non défini pour ${game.nb_joueurs} joueurs.`); return }
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
    await supabase.from('games').update({
      phase: 'CONSEQUENCES',
      resultat_fleur: resultat,
      fleurs_ecloses: (game?.fleurs_ecloses ?? 0) + (resultat === 'eclose' ? 1 : 0),
      fleurs_fanees:  (game?.fleurs_fanees  ?? 0) + (resultat === 'fanee'  ? 1 : 0),
    }).eq('id', id)
  }

  async function avancerVersFleur(nextIndex: number) {
    // Réinitialise mission_resultat pour tous les joueurs
    await Promise.all(joueurs.map(j =>
      supabase.from('players').update({ mission_resultat: null }).eq('id', j.id)
    ))
    setResultatVote(null)
    setJoueurRevele(null)

    if (nextIndex >= 5) {
      await supabase.from('games').update({ phase: 'FIN' }).eq('id', id)
    } else {
      await supabase.from('games').update({
        phase: 'FLEUR_EN_COURS',
        fleur_index: nextIndex,
        resultat_fleur: null,
        vote_lance: false,
      }).eq('id', id)
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
    if (votesFleur.length === 0) {
      setResultatVote({ egalite: true })
      return
    }
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
    if (joueur.role === 'ronce') {
      await supabase.from('players').update({ elimine: true }).eq('id', joueur.id)
    }
    setJoueurRevele({ joueur, role: joueur.role })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-bloom-cream-light flex items-center justify-center px-5">
        <p className="font-title text-2xl text-bloom-violet-dark">Chargement...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bloom-cream-light flex flex-col items-center px-5 py-10 gap-6">
      <button onClick={() => router.push('/')} className="fixed top-4 left-4 text-bloom-violet-dark text-base font-semibold bg-transparent">
        ← Accueil
      </button>

      {game?.phase !== 'LOBBY' && (
        <div className="fixed top-3 right-3 flex gap-1.5 z-50">
          <div className="flex items-center gap-1 bg-bloom-gray-dark rounded-xl px-2.5 py-1.5">
            <span className="text-base leading-none">🌸</span>
            <span className="font-body text-sm font-bold text-bloom-gold leading-none">{game?.fleurs_ecloses ?? 0}</span>
          </div>
          <div className="flex items-center gap-1 bg-bloom-gray-dark rounded-xl px-2.5 py-1.5">
            <span className="text-base leading-none">🥀</span>
            <span className="font-body text-sm font-bold text-bloom-gold leading-none">{game?.fleurs_fanees ?? 0}</span>
          </div>
        </div>
      )}

      <img src="/logo-baseline.png" alt="BLOOM" className="w-64 mt-4" />

      {/* ── LOBBY ── */}
      {game?.phase === 'LOBBY' && (
        <>
          <div className="w-[90%] max-w-lg mx-auto bg-white rounded-2xl p-6 text-center shadow-md">
            <p className="text-bloom-violet-medium text-base">Code de la partie</p>
            <p className="font-title tracking-widest text-bloom-violet-dark text-5xl mt-1">{game?.code}</p>
            <p className="text-bloom-violet-medium text-base mt-2">Les joueurs rejoignent sur leur téléphone</p>
          </div>
          <div className="w-[90%] max-w-lg mx-auto bg-white rounded-2xl p-6 shadow-md">
            <h2 className="font-title text-xl mb-4 text-bloom-violet-dark">Joueurs connectés ({joueurs.length}/{game?.nb_joueurs})</h2>
            <div className="flex flex-col gap-2">
              {joueurs.map(p => (
                <div key={p.id} className="bg-bloom-violet-pale rounded-xl px-4 py-3 text-base text-bloom-gray-dark">🌿 {p.pseudo}</div>
              ))}
            </div>
          </div>
          {tousConnectes && (
            <button onClick={lancerPartie} disabled={lancement} className="w-[90%] max-w-lg mx-auto min-h-[52px] bg-bloom-violet-dark text-white rounded-2xl px-6 text-xl font-bold shadow-md disabled:opacity-50">
              Lancer la partie 🌱
            </button>
          )}
        </>
      )}

      {/* ── ROLE ── */}
      {game?.phase === 'ROLE' && (
        <div className="w-[90%] max-w-lg mx-auto bg-white rounded-2xl p-6 shadow-md text-center">
          <p className="font-title text-2xl text-bloom-violet-dark mb-4">Distribution des rôles... 🌸</p>
          <p className="text-lg text-bloom-violet-medium">{nbConfirmes} / {game?.nb_joueurs} ont confirmé</p>
          <div className="flex flex-col gap-2 mt-6">
            {joueurs.map(p => (
              <div key={p.id} className="bg-bloom-violet-pale rounded-xl px-4 py-3 text-base flex justify-between text-bloom-gray-dark">
                <span>🌿 {p.pseudo}</span>
                <span>{p.mission_accomplie ? '✓' : '⏳'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FLEUR EN COURS ── */}
      {game?.phase === 'FLEUR_EN_COURS' && fleur && (
        <div className="w-[90%] max-w-lg mx-auto flex flex-col gap-4">
          {/* Fleur active */}
          <div className="bg-white rounded-2xl p-6 text-center shadow-md">
            <p className="text-7xl">{fleur.emoji}</p>
            <h2 className="font-title text-2xl text-bloom-violet-dark mt-2">{fleur.nom}</h2>
            <p className="text-bloom-violet-medium text-sm mt-1">Fleur {fleurIndex + 1} / 5</p>
          </div>

          {/* Ressources requises */}
          {requis && (
            <div className="bg-white rounded-2xl p-5 shadow-md">
              <h3 className="font-title text-base text-bloom-violet-dark mb-3">Ressources requises</h3>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(requis) as [string, number][])
                  .filter(([, n]) => n > 0)
                  .map(([res, n]) => {
                    const info = CARTE_INFO[res]
                    return (
                      <span
                        key={res}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold text-bloom-black"
                        style={{ backgroundColor: (info?.couleur ?? '#ccc') + '66' }}
                      >
                        {info?.emoji} {n}× {info?.label}
                      </span>
                    )
                  })}
              </div>
              {fleurConfig && (
                <p className="text-bloom-rose text-sm mt-3">
                  ⚠️ Max {fleurConfig.qn} effet(s) négatif(s) toléré(s)
                </p>
              )}
            </div>
          )}

          {/* Missions signalées */}
          <div className="bg-white rounded-2xl p-4 shadow-md text-center">
            <p className="text-bloom-violet-medium text-sm">Missions signalées</p>
            <p className="font-title text-3xl text-bloom-violet-dark mt-1">
              {nbMissionsSignalees} / {joueurs.length}
            </p>
          </div>

          {/* Boutons résultat — gros, bien espacés */}
          <button
            onClick={() => signalerResultat('eclose')}
            className="w-full min-h-[72px] bg-bloom-green text-white rounded-2xl px-6 text-xl font-bold shadow-md"
          >
            🌸 Fleur éclose
          </button>
          <button
            onClick={() => signalerResultat('fanee')}
            className="w-full min-h-[72px] bg-bloom-rose text-white rounded-2xl px-6 text-xl font-bold shadow-md"
          >
            🥀 Fleur fanée
          </button>
        </div>
      )}

      {/* ── CONSÉQUENCES ── */}
      {game?.phase === 'CONSEQUENCES' && (
        <div className="w-[90%] max-w-lg mx-auto flex flex-col gap-4">
          {/* Résultat fleur */}
          <div className={`rounded-2xl p-8 text-center shadow-md ${game.resultat_fleur === 'eclose' ? 'bg-bloom-green-light' : 'bg-bloom-rose-light'}`}>
            <p className="text-7xl">{game.resultat_fleur === 'eclose' ? '🌸' : '🥀'}</p>
            <p className="font-title text-3xl text-bloom-black mt-3">
              {game.resultat_fleur === 'eclose' ? 'Fleur éclose !' : 'Fleur fanée...'}
            </p>
          </div>

          {/* Bilan missions */}
          <div className="bg-white rounded-2xl p-5 shadow-md text-center">
            <p className="font-title text-4xl text-bloom-violet-dark">{nbMissionsReussies}</p>
            <p className="text-bloom-violet-medium mt-1">
              mission{nbMissionsReussies > 1 ? 's' : ''} accomplie{nbMissionsReussies > 1 ? 's' : ''} sur {joueurs.length}
            </p>
          </div>

          {/* Note modificateurs */}
          <div className="bg-bloom-violet-pale rounded-2xl p-4 text-center">
            <p className="text-sm text-bloom-violet-dark">
              ✨ Les modificateurs s'appliquent à la fleur suivante
            </p>
          </div>

          <button
            onClick={continuerApresCons}
            className="w-full min-h-[52px] bg-bloom-violet-dark text-white rounded-2xl px-6 text-base font-bold shadow-md"
          >
            {fleurIndex === 0 ? 'Continuer →' : 'Continuer (vote) →'}
          </button>
        </div>
      )}

      {/* ── VOTE ── */}
      {game?.phase === 'VOTE' && (
        <div className="w-[90%] max-w-lg mx-auto flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-5 text-center shadow-md">
            <p className="text-4xl">🗳️</p>
            <h2 className="font-title text-xl text-bloom-violet-dark mt-2">Phase de vote</h2>
            <p className="text-bloom-violet-medium text-sm mt-1">Le groupe désigne un suspect Ronce</p>
          </div>

          {!game?.vote_lance && !resultatVote && !joueurRevele && (
            <>
              <button onClick={lancerVote} className="w-full min-h-[64px] bg-bloom-violet-dark text-white rounded-2xl px-6 text-lg font-bold shadow-md">
                Lancer le vote 🗳️
              </button>
              <button onClick={() => avancerVersFleur(fleurIndex + 1)} className="w-full min-h-[52px] bg-white text-bloom-violet-dark border-2 border-bloom-violet-light rounded-2xl px-6 text-base font-bold shadow-md">
                Passer sans voter →
              </button>
            </>
          )}

          {game?.vote_lance && !resultatVote && !joueurRevele && (
            <>
              <div className="bg-white rounded-2xl p-5 text-center shadow-md">
                <p className="font-title text-4xl text-bloom-violet-dark">{votesFleur.length} / {joueurActifs.length}</p>
                <p className="text-bloom-violet-medium mt-1">joueurs ont voté</p>
              </div>
              <button
                onClick={voirResultatVote}
                className="w-full min-h-[52px] bg-bloom-gold text-bloom-black rounded-2xl px-6 text-base font-bold shadow-md"
              >
                Voir les résultats →
              </button>
            </>
          )}

          {resultatVote && !joueurRevele && (
            <>
              {resultatVote.egalite || !resultatVote.vainqueur ? (
                <div className="bg-white rounded-2xl p-6 text-center shadow-md">
                  <p className="text-4xl">🤷</p>
                  <p className="font-title text-xl text-bloom-violet-dark mt-2">Égalité ou aucun vote</p>
                  <p className="text-sm text-bloom-violet-medium mt-1">Personne n'est désigné</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 text-center shadow-md">
                  <p className="text-4xl">🎯</p>
                  <p className="font-title text-xl text-bloom-violet-dark mt-2">
                    {resultatVote.vainqueur.pseudo} est désigné
                  </p>
                  <p className="text-sm text-bloom-violet-medium mt-1">{resultatVote.nbVotes} vote(s)</p>
                </div>
              )}

              {!resultatVote.egalite && resultatVote.vainqueur && (
                <button
                  onClick={() => revelerRole(resultatVote.vainqueur)}
                  className="w-full min-h-[64px] bg-bloom-rose text-white rounded-2xl px-6 text-lg font-bold shadow-md"
                >
                  Révéler le rôle de {resultatVote.vainqueur.pseudo}
                </button>
              )}

              <button
                onClick={() => avancerVersFleur(fleurIndex + 1)}
                className="w-full min-h-[52px] bg-white text-bloom-violet-dark border-2 border-bloom-violet-light rounded-2xl px-6 text-base font-bold shadow-md"
              >
                {resultatVote.egalite ? 'Continuer →' : 'Passer sans révéler →'}
              </button>
            </>
          )}

          {joueurRevele && (
            <>
              <div className={`rounded-2xl p-8 text-center shadow-md ${joueurRevele.role === 'ronce' ? 'bg-bloom-rose-light' : 'bg-bloom-green-light'}`}>
                <p className="text-6xl">{joueurRevele.role === 'ronce' ? '🥀' : '🌸'}</p>
                <p className="font-title text-2xl text-bloom-black mt-3">
                  {joueurRevele.joueur.pseudo} était {joueurRevele.role === 'ronce' ? 'une Ronce !' : 'un Jardinier...'}
                </p>
                {joueurRevele.role === 'ronce' && (
                  <p className="text-sm text-bloom-gray-dark mt-2">Joueur éliminé pour les votes suivants</p>
                )}
                {joueurRevele.role === 'jardinier' && (
                  <p className="text-sm text-bloom-gray-dark mt-2">Le jeu continue normalement.</p>
                )}
              </div>
              <button
                onClick={() => avancerVersFleur(fleurIndex + 1)}
                className="w-full min-h-[52px] bg-bloom-violet-dark text-white rounded-2xl px-6 text-base font-bold shadow-md"
              >
                {fleurIndex >= 4 ? 'Voir le résultat final →' : 'Fleur suivante →'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── FIN ── */}
      {game?.phase === 'FIN' && (
        <div className="w-[90%] max-w-lg mx-auto bg-white rounded-2xl p-8 text-center shadow-md">
          <p className="text-6xl">🌺</p>
          <h2 className="font-title text-3xl text-bloom-violet-dark mt-4">Partie terminée !</h2>
          <p className="text-base text-bloom-violet-medium mt-3">Merci d&apos;avoir joué à BLOOM</p>
        </div>
      )}
    </main>
  )
}
