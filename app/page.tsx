'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from './providers'
import { t } from '@/lib/translations'

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

type Etape = 'choix' | 'arbre' | 'joueur'

function FloralCorner({ className }: { className?: string }) {
  return (
    <svg className={className} width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden>
      <ellipse cx="60" cy="30" rx="10" ry="22" fill="currentColor" transform="rotate(0 60 60)"   opacity=".35"/>
      <ellipse cx="60" cy="30" rx="10" ry="22" fill="currentColor" transform="rotate(45 60 60)"  opacity=".28"/>
      <ellipse cx="60" cy="30" rx="10" ry="22" fill="currentColor" transform="rotate(90 60 60)"  opacity=".35"/>
      <ellipse cx="60" cy="30" rx="10" ry="22" fill="currentColor" transform="rotate(135 60 60)" opacity=".28"/>
      <ellipse cx="60" cy="30" rx="10" ry="22" fill="currentColor" transform="rotate(180 60 60)" opacity=".22"/>
      <ellipse cx="60" cy="30" rx="10" ry="22" fill="currentColor" transform="rotate(225 60 60)" opacity=".18"/>
      <ellipse cx="60" cy="30" rx="10" ry="22" fill="currentColor" transform="rotate(270 60 60)" opacity=".22"/>
      <ellipse cx="60" cy="30" rx="10" ry="22" fill="currentColor" transform="rotate(315 60 60)" opacity=".18"/>
      <circle  cx="60" cy="60" r="9" fill="currentColor" opacity=".45"/>
    </svg>
  )
}


const KEYFRAMES = `

@keyframes btn-pulse-arbre {
  0%, 100% { box-shadow: 0 5px 0 #372e5a, 0 4px 16px rgba(79,68,115,0.20); }
  50%      { box-shadow: 0 5px 0 #372e5a, 0 18px 52px rgba(79,68,115,0.65); }
}
@keyframes btn-pulse-joueur {
  0%, 100% { box-shadow: 0 5px 0 #9c4e68, 0 4px 16px rgba(207,107,136,0.18); }
  50%      { box-shadow: 0 5px 0 #9c4e68, 0 18px 52px rgba(207,107,136,0.62); }
}
@keyframes btn-tap {
  0%   { transform: scale(1); }
  40%  { transform: scale(0.90); }
  70%  { transform: scale(1.08); }
  100% { transform: scale(1); }
}
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes screen-exit {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to   { opacity: 0; transform: scale(0.85) translateY(-20px); }
}
@keyframes screen-enter {
  from { opacity: 0; transform: scale(0.85) translateY(20px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
`

export default function Home() {
  const router = useRouter()
  const { lang } = useLang()
  const [etape, setEtape] = useState<Etape>('choix')
  const [pseudo, setPseudo] = useState('')
  const [code, setCode] = useState('')
  const [nbJoueurs, setNbJoueurs] = useState(4)
  const [loading, setLoading] = useState(false)
  const [clicking, setClicking] = useState<'arbre' | 'joueur' | null>(null)
  const [screenAnim, setScreenAnim] = useState<'exit' | 'enter' | null>(null)
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const role = params.get('role')
    if (role === 'arbre' || role === 'joueur') setEtape(role)
  }, [])

  function handleChoice(choice: 'arbre' | 'joueur') {
    setClicking(choice)
    setTimeout(() => setScreenAnim('exit'), 80)
    setTimeout(() => {
      setClicking(null)
      setEtape(choice)
      setScreenAnim('enter')
    }, 320)
    setTimeout(() => setScreenAnim(null), 650)
  }

  function handleRetour() {
    setScreenAnim('exit')
    setTimeout(() => {
      setEtape('choix')
      setScreenAnim('enter')
    }, 240)
    setTimeout(() => setScreenAnim(null), 560)
  }

  async function creerPartie() {
    setLoading(true)
    const gameCode = generateCode()
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({ code: gameCode, nb_joueurs: nbJoueurs })
      .select()
      .single()

    if (!game) { console.error(gameError); setLoading(false); return }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ game_id: game.id, pseudo: 'Grand Arbre', role: 'grand_arbre' })
      .select()
      .single()

    if (!player) { console.error(playerError); setLoading(false); return }

    sessionStorage.setItem(`player_id_${game.id}`, player.id)
    router.push(`/game/${game.id}/table`)
  }

  async function rejoindrePartie() {
    if (!pseudo || !code) return
    setLoading(true)
    const { data: game } = await supabase
      .from('games')
      .select()
      .eq('code', code.toUpperCase())
      .single()

    if (!game) { alert(t('partie_introuvable', lang)); setLoading(false); return }

    const { data: player } = await supabase
      .from('players')
      .insert({ game_id: game.id, pseudo })
      .select()
      .single()

    if (!player) { setLoading(false); return }

    sessionStorage.setItem(`player_id_${game.id}`, player.id)
    router.push(`/game/${game.id}/player`)
  }

  return (
    <main className="bloom-bg min-h-screen flex flex-col items-center px-5 pb-10 relative overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* Filigranes floraux décoratifs */}
      <FloralCorner className="absolute top-0 left-0 text-bloom-violet-light opacity-[0.07] -translate-x-6 -translate-y-6 rotate-[-20deg]" />
      <FloralCorner className="absolute bottom-0 right-0 text-bloom-violet-medium opacity-[0.06] translate-x-8 translate-y-8 rotate-[15deg]" />
      <FloralCorner className="absolute top-1/2 right-2 text-bloom-gold opacity-[0.05] scale-75" />

      {/* Bouton retour */}
      {etape !== 'choix' && (
        <button
          onClick={handleRetour}
          className="fixed top-4 left-4 z-10 flex items-center justify-center w-12 h-12 rounded-full bg-bloom-violet-pale text-bloom-violet-dark shadow-sm"
          aria-label={t('retour', lang)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12L12 3l9 9"/><path d="M5 10v9h5v-5h4v5h5v-9"/>
          </svg>
        </button>
      )}

      {/* Logo — ancré à position fixe, indépendant de la hauteur du contenu */}
      <div className="w-full flex justify-center pt-[9vh] pb-8 shrink-0">
        <img
          src={`${BASE}/logo-baseline.png`}
          alt="BLOOM — Tout peut fleurir. Même le doute..."
          className="w-full max-w-[26rem] drop-shadow-sm"
        />
      </div>

      {/* Contenu — animé à chaque changement d'étape, dans l'espace restant */}
      <div className="flex-1 w-full flex flex-col items-center justify-center">
        <div
          className="w-full flex flex-col items-center"
          style={{
            animation: screenAnim === 'exit'  ? 'screen-exit 240ms ease-in forwards'
                     : screenAnim === 'enter' ? 'screen-enter 320ms ease-out forwards'
                     : undefined,
          }}
        >

        {/* ── Choix du rôle ── */}
        {etape === 'choix' && (
          <div className="w-[90%] max-w-sm flex flex-col items-center gap-5">

            <button
              onClick={() => handleChoice('arbre')}
              className="btn-bloom w-full text-lg"
              style={{
                animation: clicking === 'arbre'
                  ? 'btn-tap 220ms ease-out forwards'
                  : 'btn-pulse-arbre 3.6s ease-in-out infinite',
              }}
            >
              {t('btn_arbre', lang)}
            </button>

            <button
              onClick={() => handleChoice('joueur')}
              className="btn-rose w-full text-lg"
              style={{
                animation: clicking === 'joueur'
                  ? 'btn-tap 220ms ease-out forwards'
                  : 'btn-pulse-joueur 3.9s ease-in-out 1.4s infinite',
              }}
            >
              {t('btn_joueur', lang)}
            </button>

            <button
              onClick={() => setShowRules(true)}
              className="w-full min-h-[52px] rounded-[18px] border-2 border-bloom-violet-light bg-bloom-violet-pale/40 text-bloom-violet-dark font-body font-semibold text-base transition-colors hover:bg-bloom-violet-pale"
            >
              {t('rules_btn', lang)}
            </button>
          </div>
        )}

        {/* ── Créer une partie ── */}
        {etape === 'arbre' && (
          <div className="card-bloom w-[90%] max-w-sm p-6 flex flex-col gap-4">
            <h2 className="font-title text-xl text-bloom-violet-dark text-center">
              {t('creer_partie', lang)}
            </h2>
            <select
              className="min-h-[52px] border-2 border-bloom-violet-light rounded-xl px-4 text-base bg-white/80 focus:outline-none focus:border-bloom-violet-dark"
              value={nbJoueurs}
              onChange={e => setNbJoueurs(Number(e.target.value))}
            >
              {[4,5,6,7,8].map(n => (
                <option key={n} value={n}>{n} {t('joueurs_opt', lang)}</option>
              ))}
            </select>
            <button
              onClick={creerPartie}
              disabled={loading}
              className="btn-bloom w-full"
            >
              {loading ? t('creation_en_cours', lang) : t('creer_btn', lang)}
            </button>
          </div>
        )}

        {/* ── Rejoindre une partie ── */}
        {etape === 'joueur' && (
          <div className="card-bloom w-[90%] max-w-sm p-6 flex flex-col gap-4">
            <h2 className="font-title text-xl text-bloom-rose text-center">
              {t('rejoindre_titre', lang)}
            </h2>
            <input
              className="min-h-[52px] border-2 border-bloom-violet-light rounded-xl px-4 text-base bg-white/80 focus:outline-none focus:border-bloom-violet-dark uppercase tracking-widest"
              placeholder={t('placeholder_code', lang)}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <input
              className="min-h-[52px] border-2 border-bloom-violet-light rounded-xl px-4 text-base bg-white/80 focus:outline-none focus:border-bloom-violet-dark"
              placeholder={t('placeholder_pseudo', lang)}
              value={pseudo}
              onChange={e => setPseudo(e.target.value)}
            />
            <button
              onClick={rejoindrePartie}
              disabled={loading || !pseudo || !code}
              className="btn-rose w-full"
            >
              {loading ? t('connexion_en_cours', lang) : t('rejoindre_btn', lang)}
            </button>
          </div>
        )}

        </div>
      </div>
      {/* ── Modale règles du jeu ── */}
      {showRules && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(30,20,50,0.55)' }}
          onClick={() => setShowRules(false)}
        >
          <div
            className="relative w-full max-w-lg bg-bloom-cream rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
            style={{ animation: 'modal-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Bouton fermeture */}
            <button
              onClick={() => setShowRules(false)}
              aria-label="Fermer"
              className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-bloom-violet-pale text-bloom-violet-dark hover:bg-bloom-violet-light/30"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <line x1="3" y1="3" x2="15" y2="15"/><line x1="15" y1="3" x2="3" y2="15"/>
              </svg>
            </button>

            <div className="p-6 pt-7 flex flex-col gap-5">

              {/* Titre */}
              <h2 className="font-title text-2xl text-bloom-violet-dark text-center pr-8">
                {t('rules_title', lang)}
              </h2>

              {/* Le Grand Arbre */}
              <section className="flex flex-col gap-1">
                <h3 className="font-title text-base text-bloom-violet-dark">{t('rules_grand_arbre_title', lang)}</h3>
                <p className="font-body text-sm text-bloom-gray-dark">{t('rules_grand_arbre_desc', lang)}</p>
              </section>

              <hr className="border-bloom-violet-light/40" />

              {/* Les deux camps */}
              <section className="flex flex-col gap-2">
                <h3 className="font-title text-base text-bloom-violet-dark">{t('rules_camps_title', lang)}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4" style={{ backgroundColor: '#DBE4D4' }}>
                    <p className="font-body font-bold text-sm text-bloom-gray-dark mb-1">{t('rules_jardiniers_name', lang)}</p>
                    <p className="font-body text-sm text-bloom-gray-dark">{t('rules_jardiniers_desc', lang)}</p>
                  </div>
                  <div className="rounded-2xl p-4" style={{ backgroundColor: '#F9DCE3' }}>
                    <p className="font-body font-bold text-sm text-bloom-gray-dark mb-1">{t('rules_ronces_name', lang)}</p>
                    <p className="font-body text-sm text-bloom-gray-dark">{t('rules_ronces_desc', lang)}</p>
                  </div>
                </div>
              </section>

              <hr className="border-bloom-violet-light/40" />

              {/* Déroulement */}
              <section className="flex flex-col gap-2">
                <h3 className="font-title text-base text-bloom-violet-dark">{t('rules_deroulement_title', lang)}</h3>
                <p className="font-body text-sm text-bloom-gray-dark">{t('rules_flow', lang)}</p>
              </section>

              <hr className="border-bloom-violet-light/40" />

              {/* Entre les fleurs */}
              <section className="flex flex-col gap-2">
                <h3 className="font-title text-base text-bloom-violet-dark">{t('rules_entre_title', lang)}</h3>
                <p className="font-body text-sm text-bloom-gray-dark">{t('rules_vote', lang)}</p>
              </section>

              <hr className="border-bloom-violet-light/40" />

              {/* Victoire */}
              <section className="flex flex-col gap-2">
                <h3 className="font-title text-base text-bloom-violet-dark">{t('rules_victoire_title', lang)}</h3>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-bloom-green shrink-0 mt-1" />
                    <p className="font-body text-sm text-bloom-gray-dark">{t('rules_victoire_jardiniers', lang)}</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-bloom-rose shrink-0 mt-1" />
                    <p className="font-body text-sm text-bloom-gray-dark">{t('rules_victoire_ronces', lang)}</p>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </div>
      )}

    </main>
  )
}
