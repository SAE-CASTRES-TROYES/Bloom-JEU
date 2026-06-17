'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

type Etape = 'choix' | 'arbre' | 'joueur'

export default function Home() {
  const router = useRouter()
  const [etape, setEtape] = useState<Etape>('choix')
  const [pseudo, setPseudo] = useState('')
  const [code, setCode] = useState('')
  const [nbJoueurs, setNbJoueurs] = useState(4)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const role = params.get('role')
    if (role === 'arbre' || role === 'joueur') setEtape(role)
  }, [])

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

    localStorage.setItem('player_id', player.id)
    localStorage.setItem('game_id', game.id)
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

    if (!game) { alert('Partie introuvable !'); setLoading(false); return }

    const { data: player } = await supabase
      .from('players')
      .insert({ game_id: game.id, pseudo })
      .select()
      .single()

    if (!player) { setLoading(false); return }

    localStorage.setItem('player_id', player.id)
    localStorage.setItem('game_id', game.id)
    router.push(`/game/${game.id}/player`)
  }

  return (
    <main className="min-h-screen bg-bloom-cream-light flex flex-col items-center px-5 py-12 gap-8">
      {etape !== 'choix' && (
        <button
          onClick={() => setEtape('choix')}
          className="fixed top-4 left-4 text-bloom-violet-dark text-base font-semibold bg-transparent"
        >
          ← Retour
        </button>
      )}

      <img src="/logo-baseline.png" alt="BLOOM — Tout peut fleurir. Même le doute..." className="w-72" />

      {etape === 'choix' && (
        <div className="w-[90%] max-w-sm flex flex-col gap-4">
          <button
            onClick={() => window.open('/?role=arbre', '_blank')}
            className="min-h-[52px] bg-bloom-violet-dark text-white rounded-2xl px-6 text-base font-bold shadow-md"
          >
            🌳 Cet appareil est le Grand Arbre
          </button>
          <button
            onClick={() => window.open('/?role=joueur', '_blank')}
            className="min-h-[52px] bg-bloom-rose text-white rounded-2xl px-6 text-base font-bold shadow-md"
          >
            🌿 Cet appareil est un joueur
          </button>
        </div>
      )}

      {etape === 'arbre' && (
        <div className="w-[90%] max-w-sm bg-white rounded-2xl shadow-md p-6 flex flex-col gap-4">
          <h2 className="font-title text-xl text-bloom-violet-dark text-center">Créer une partie</h2>
          <select
            className="min-h-[52px] border-2 border-bloom-violet-light rounded-xl px-4 text-base bg-white focus:outline-none focus:border-bloom-violet-dark"
            value={nbJoueurs}
            onChange={e => setNbJoueurs(Number(e.target.value))}
          >
            {[4,5,6,7,8].map(n => <option key={n} value={n}>{n} joueurs</option>)}
          </select>
          <button
            onClick={creerPartie}
            disabled={loading}
            className="min-h-[52px] bg-bloom-violet-dark text-white rounded-2xl px-6 text-base font-bold shadow-md disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer la partie 🌱'}
          </button>
        </div>
      )}

      {etape === 'joueur' && (
        <div className="w-[90%] max-w-sm bg-white rounded-2xl shadow-md p-6 flex flex-col gap-4">
          <h2 className="font-title text-xl text-bloom-rose text-center">Rejoindre une partie</h2>
          <input
            className="min-h-[52px] border-2 border-bloom-violet-light rounded-xl px-4 text-base bg-white focus:outline-none focus:border-bloom-violet-dark uppercase tracking-widest"
            placeholder="Code de partie"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <input
            className="min-h-[52px] border-2 border-bloom-violet-light rounded-xl px-4 text-base bg-white focus:outline-none focus:border-bloom-violet-dark"
            placeholder="Ton pseudo"
            value={pseudo}
            onChange={e => setPseudo(e.target.value)}
          />
          <button
            onClick={rejoindrePartie}
            disabled={loading || !pseudo || !code}
            className="min-h-[52px] bg-bloom-rose text-white rounded-2xl px-6 text-base font-bold shadow-md disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Rejoindre la partie →'}
          </button>
        </div>
      )}
    </main>
  )
}
