export function getNbRonces(nbJoueurs: number): number {
  if (nbJoueurs <= 4) return 1
  if (nbJoueurs <= 6) return 2
  return 3
}

// ─── Deck (fixe, 112 cartes) ───────────────────────────────────────────────
// La pile de défausse est remélangée dans la pioche si elle se vide.
// Vent Mauvais annule une ressource au hasard mais ne compte PAS dans le quota négatif.

export const DECK_COMPOSITION: Record<string, number> = {
  eau:          20,
  soleil:       22,
  terre:        16,
  vent:         28,
  pollen:        6,
  epine:        10,
  seve:          4,
  bouclier:      2,
  vent_mauvais:  4,
}

// ─── Missions ──────────────────────────────────────────────────────────────

export const JARDINIER_MISSIONS = [
  { id: 'silence_sacre',       texte: "Ne dis rien pendant toute la phase de discussion" },
  { id: 'premier_bourgeon',    texte: "Sois le premier joueur à poser ta carte" },
  { id: 'instinct_botanique',  texte: "Joue exactement la ressource la plus demandée par la fleur" },
  { id: 'gardien_fleurs',      texte: "Ne parle pas de tes cartes mais pose sans hésiter" },
]

export const RONCE_MISSIONS = [
  { id: 'racines_envahissantes', texte: "Convaincs au moins 1 joueur de jouer la même ressource que toi" },
  { id: 'penurie',               texte: "Annonce que tu n'as pas la ressource requise alors que tu l'as" },
  { id: 'epine_cachee',          texte: "Joue une carte négative lors de cette fleur" },
  { id: 'innocence_trompeuse',   texte: "Ne joue aucune carte négative durant toute cette fleur" },
]

function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function construireDeck(): string[] {
  const cartes = Object.entries(DECK_COMPOSITION).flatMap(([carte, n]) => Array(n).fill(carte))
  return shuffle(cartes)
}

export function distribuerRoles(joueurIds: string[], nbJoueurs: number): Record<string, 'ronce' | 'jardinier'> {
  const nbRonces = getNbRonces(nbJoueurs)
  const ordreAleatoire = shuffle(joueurIds)
  const ronceIds = new Set(ordreAleatoire.slice(0, nbRonces))
  const roles: Record<string, 'ronce' | 'jardinier'> = {}
  for (const id of joueurIds) {
    roles[id] = ronceIds.has(id) ? 'ronce' : 'jardinier'
  }
  return roles
}

export function tirerMission(role: 'ronce' | 'jardinier') {
  const missions = role === 'ronce' ? RONCE_MISSIONS : JARDINIER_MISSIONS
  return missions[Math.floor(Math.random() * missions.length)]
}

// ─── Fleurs ────────────────────────────────────────────────────────────────

export const FLEURS = [
  { nom: 'Lavande des Souvenirs' },
  { nom: 'Tulipe du Premier Printemps' },
  { nom: 'Mimosa de l\'Aurore' },
  { nom: 'Lys des Premières Lueurs' },
  { nom: 'Dahlia du Crépuscule Pourpre' },
]

export type TourReqis = { eau: number; soleil: number; terre: number; vent: number; pollen: number }
export type FleurConfig = { requis: TourReqis; qn: number }

const r = (eau: number, soleil: number, terre: number, vent: number, pollen: number): TourReqis =>
  ({ eau, soleil, terre, vent, pollen })

export const FLEUR_CONFIGS: Record<number, Record<number, FleurConfig>> = {
  0: { // Lavande
    4: { requis: r(2,1,2,0,0), qn: 1 },
    5: { requis: r(2,1,2,1,0), qn: 2 },
    6: { requis: r(2,2,2,1,0), qn: 2 },
    7: { requis: r(3,2,2,1,0), qn: 2 },
    8: { requis: r(3,2,2,2,0), qn: 2 },
  },
  1: { // Rose
    4: { requis: r(1,2,2,0,0), qn: 1 },
    5: { requis: r(1,3,2,0,0), qn: 2 },
    6: { requis: r(1,3,2,1,0), qn: 2 },
    7: { requis: r(2,3,2,1,0), qn: 2 },
    8: { requis: r(2,4,2,1,0), qn: 2 },
  },
  2: { // Mimosas
    4: { requis: r(4,3,3,1,1), qn: 2 },
    5: { requis: r(4,5,3,1,1), qn: 2 },
    6: { requis: r(5,5,3,2,1), qn: 2 },
    7: { requis: r(5,6,4,2,1), qn: 3 },
    8: { requis: r(6,7,4,2,1), qn: 3 },
  },
  3: { // Lys
    4: { requis: r(1,2,1,7,1), qn: 2 },
    5: { requis: r(2,3,1,8,0), qn: 2 },
    6: { requis: r(2,3,2,9,0), qn: 2 },
    7: { requis: r(2,4,2,10,0), qn: 3 },
    8: { requis: r(2,4,2,12,0), qn: 3 },
  },
  4: { // Dahlia
    4: { requis: r(3,4,2,3,2), qn: 2 },
    5: { requis: r(3,6,2,3,2), qn: 3 },
    6: { requis: r(5,6,2,4,1), qn: 3 },
    7: { requis: r(5,6,4,4,1), qn: 3 },
    8: { requis: r(5,8,4,4,1), qn: 4 },
  },
}

// ─── Illustrations de fleurs ───────────────────────────────────────────────

export const FLEUR_ILLUS: Record<number, { eclos: string; fane: string }> = {
  0: { eclos: '/illustrations/fleurs/lavande.png',  fane: '/illustrations/fleurs/lavande-fanee.png' },
  1: { eclos: '/illustrations/fleurs/tulipe.png',   fane: '/illustrations/fleurs/tulipe-fane.png' },
  2: { eclos: '/illustrations/fleurs/mimosa.png',   fane: '/illustrations/fleurs/mimosa-fane.png' },
  3: { eclos: '/illustrations/fleurs/lys.png',      fane: '/illustrations/fleurs/lys-fane.png' },
  4: { eclos: '/illustrations/fleurs/dahlia.webp',  fane: '/illustrations/fleurs/dahlia-fane.webp' },
}

// ─── Cartes ────────────────────────────────────────────────────────────────

export const CARTE_INFO: Record<string, { label: string; couleur: string }> = {
  eau:          { label: 'Eau',            couleur: '#95C6D8' },
  soleil:       { label: 'Soleil',         couleur: '#E9C75F' },
  terre:        { label: 'Terre',          couleur: '#6C855A' },
  vent:         { label: 'Vent',           couleur: '#C1ECFD' },
  pollen:       { label: 'Pollen (joker)', couleur: '#CABFE3' },
  epine:        { label: 'Épines',          couleur: '#CF6B88' },
  vent_mauvais: { label: 'Bourrasque',     couleur: '#8F77C7' },
  seve:         { label: 'Sève Purifiante', couleur: '#6C855A' },
  bouclier:     { label: 'Mousse Protectrice', couleur: '#4F4473' },
}

// ─── Calcul d'un tour ──────────────────────────────────────────────────────

export type ResultatTour = {
  statut: 'succes' | 'fane' | 'rejoue'
  effetsNegTotal: number
  effetsNegCeTour: number
  comptesRaw: Record<string, number>
  rempli: { eau: number; soleil: number; terre: number; vent: number; pollen: number }
  requis: TourReqis
  epines: number
  seves: number
  boucliers: number
  vents_mauvais: number
  nullifie?: string
}

export function calculerTour(
  cartes: string[],
  requis: TourReqis,
  quotaNeg: number,
  effetsNegAvant: number,
): ResultatTour {
  const cnt = (t: string) => cartes.filter(c => c === t).length
  const comptesRaw: Record<string, number> = {}
  cartes.forEach(c => { comptesRaw[c] = (comptesRaw[c] || 0) + 1 })

  const epines        = cnt('epine')
  const vents_mauvais = cnt('vent_mauvais')
  const seves         = cnt('seve')
  const boucliers     = cnt('bouclier')

  let eau    = cnt('eau')
  let soleil = cnt('soleil')
  let terre  = cnt('terre')
  let vent   = cnt('vent')
  let pollen = cnt('pollen')

  // Vent mauvais : annule aléatoirement une ressource correcte (ne compte pas dans le quota négatif)
  let nullifie: string | undefined
  for (let i = 0; i < vents_mauvais; i++) {
    const pool: string[] = []
    if (eau    > 0 && requis.eau    > 0) pool.push('eau')
    if (soleil > 0 && requis.soleil > 0) pool.push('soleil')
    if (terre  > 0 && requis.terre  > 0) pool.push('terre')
    if (vent   > 0 && requis.vent   > 0) pool.push('vent')
    if (pool.length > 0) {
      const cible = pool[Math.floor(Math.random() * pool.length)]
      nullifie = cible
      if (cible === 'eau')         eau--
      else if (cible === 'soleil') soleil--
      else if (cible === 'terre')  terre--
      else if (cible === 'vent')   vent--
    }
  }

  const gapEau    = Math.max(0, requis.eau    - eau)
  const gapSoleil = Math.max(0, requis.soleil - soleil)
  const gapTerre  = Math.max(0, requis.terre  - terre)
  const gapVent   = Math.max(0, requis.vent   - vent)
  const gapPollen = requis.pollen
  const totalGap  = gapEau + gapSoleil + gapTerre + gapVent + gapPollen

  const surplusNonPollen =
    Math.max(0, eau    - requis.eau)    +
    Math.max(0, soleil - requis.soleil) +
    Math.max(0, terre  - requis.terre)  +
    Math.max(0, vent   - requis.vent)

  const pollenUsed    = Math.min(pollen, totalGap)
  const pollenRestant = pollen - pollenUsed
  const gapsRestants  = totalGap - pollenUsed

  const resourcesOK = gapsRestants === 0 && surplusNonPollen === 0 && pollenRestant === 0

  const effetsNegCeTour = Math.max(0, epines - seves)
  const effetsNegTotal  = effetsNegAvant + effetsNegCeTour

  const quotaAtteint  = effetsNegTotal >= quotaNeg
  const bouclierSauve = boucliers > 0 && effetsNegTotal === quotaNeg

  let statut: 'succes' | 'fane' | 'rejoue'
  if (quotaAtteint && !bouclierSauve) {
    statut = 'fane'
  } else if (!resourcesOK) {
    const peutRejouer =
      epines === 0 && vents_mauvais === 0 &&
      surplusNonPollen === 0 && pollenRestant === 0 &&
      gapsRestants > 0
    statut = peutRejouer ? 'rejoue' : 'fane'
  } else {
    statut = 'succes'
  }

  return {
    statut,
    effetsNegTotal,
    effetsNegCeTour,
    comptesRaw,
    rempli: { eau, soleil, terre, vent, pollen },
    requis,
    epines,
    seves,
    boucliers,
    vents_mauvais,
    nullifie,
  }
}
