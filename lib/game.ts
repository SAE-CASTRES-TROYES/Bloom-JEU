export function getNbRonces(nbJoueurs: number): number {
  if (nbJoueurs <= 4) return 1
  if (nbJoueurs <= 6) return 2
  return 3
}

export const DECK_COMPOSITIONS: Record<number, Record<string, number>> = {
  4: { ronce: 1, epine: 5, vent_mauvais: 2, seve: 3, bouclier: 2, regard: 2, eau: 7, soleil: 6, terre: 5, vent: 4, pollen: 3 },
  5: { ronce: 2, epine: 6, vent_mauvais: 2, seve: 4, bouclier: 2, regard: 2, eau: 9, soleil: 7, terre: 6, vent: 5, pollen: 4 },
  6: { ronce: 2, epine: 7, vent_mauvais: 3, seve: 4, bouclier: 3, regard: 2, eau: 10, soleil: 8, terre: 7, vent: 6, pollen: 5 },
  7: { ronce: 3, epine: 8, vent_mauvais: 3, seve: 5, bouclier: 3, regard: 3, eau: 11, soleil: 9, terre: 8, vent: 7, pollen: 5 },
  8: { ronce: 3, epine: 9, vent_mauvais: 4, seve: 5, bouclier: 3, regard: 3, eau: 13, soleil: 10, terre: 9, vent: 8, pollen: 6 },
}

export const JARDINIER_MISSIONS = [
  { id: 'silence_or', texte: "Ne dis rien pendant toute la phase de discussion" },
  { id: 'premier_corvee', texte: "Sois le premier joueur à poser ta carte" },
  { id: 'bonne_ressource', texte: "Joue exactement la ressource la plus demandée par la fleur" },
  { id: 'gardien_discret', texte: "Ne parle pas de tes cartes mais pose sans hésiter" },
]

export const RONCE_MISSIONS = [
  { id: 'trop_plein', texte: "Convaincs au moins 1 joueur de jouer la même ressource que toi" },
  { id: 'faux_manque', texte: "Annonce que tu n'as pas la ressource requise alors que tu l'as" },
  { id: 'sous_seuil', texte: "Joue une carte négative lors de cette fleur" },
  { id: 'evidente', texte: "Ne joue aucune carte négative durant toute cette fleur" },
]

function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function construireDeck(nbJoueurs: number): string[] | null {
  const composition = DECK_COMPOSITIONS[nbJoueurs]
  if (!composition) return null
  const cartes = Object.entries(composition).flatMap(([carte, n]) => Array(n).fill(carte))
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
  { nom: 'Fleur de Lune',    tours: 1 },
  { nom: "Fleur d'Aurore",   tours: 1 },
  { nom: 'Fleur de Cristal', tours: 2 },
  { nom: 'Fleur de Tempête', tours: 2 },
  { nom: 'Fleur Éternelle',  tours: 2 },
]

export type TourReqis = { eau: number; soleil: number; terre: number; vent: number; pollen: number }
export type FleurConfig = { t1: TourReqis; t2?: TourReqis; qn: number }

const r = (eau: number, soleil: number, terre: number, vent: number, pollen: number): TourReqis =>
  ({ eau, soleil, terre, vent, pollen })

export const FLEUR_CONFIGS: Record<number, Record<number, FleurConfig>> = {
  0: { // Fleur de Lune — 1 tour
    4: { t1: r(1,1,1,0,0), qn: 1 },
    5: { t1: r(2,1,0,0,0), qn: 1 },
    6: { t1: r(2,1,1,0,0), qn: 1 },
    7: { t1: r(2,2,1,0,0), qn: 1 },
    8: { t1: r(2,2,1,0,0), qn: 2 },
  },
  1: { // Fleur d'Aurore — 1 tour
    4: { t1: r(0,2,1,0,0), qn: 1 },
    5: { t1: r(0,2,1,0,0), qn: 1 },
    6: { t1: r(1,2,1,0,0), qn: 1 },
    7: { t1: r(1,2,1,1,0), qn: 2 },
    8: { t1: r(1,2,2,0,0), qn: 2 },
  },
  2: { // Fleur de Cristal — 2 tours
    4: { t1: r(2,0,0,0,1), t2: r(0,1,1,0,0), qn: 2 },
    5: { t1: r(2,0,0,0,1), t2: r(0,2,1,0,0), qn: 2 },
    6: { t1: r(2,1,0,0,1), t2: r(0,2,1,1,0), qn: 2 },
    7: { t1: r(3,1,0,0,1), t2: r(0,2,2,1,0), qn: 3 },
    8: { t1: r(3,1,0,0,1), t2: r(0,2,2,1,0), qn: 3 },
  },
  3: { // Fleur de Tempête — 2 tours
    4: { t1: r(1,0,0,2,0), t2: r(0,1,0,1,1), qn: 2 },
    5: { t1: r(1,0,0,2,0), t2: r(0,2,0,1,0), qn: 2 },
    6: { t1: r(2,0,0,2,0), t2: r(0,2,0,2,0), qn: 2 },
    7: { t1: r(2,0,0,3,0), t2: r(0,2,1,2,0), qn: 3 },
    8: { t1: r(2,0,0,3,0), t2: r(0,3,1,1,0), qn: 3 },
  },
  4: { // Fleur Éternelle — 2 tours
    4: { t1: r(1,0,1,0,1), t2: r(0,2,0,1,1), qn: 2 },
    5: { t1: r(1,0,2,0,1), t2: r(0,2,0,2,0), qn: 3 },
    6: { t1: r(2,0,2,0,1), t2: r(0,3,0,2,0), qn: 3 },
    7: { t1: r(2,0,2,1,1), t2: r(0,3,1,2,0), qn: 3 },
    8: { t1: r(2,1,2,1,1), t2: r(1,3,1,2,0), qn: 4 },
  },
}

// ─── Cartes ────────────────────────────────────────────────────────────────

export const CARTE_INFO: Record<string, { label: string; couleur: string }> = {
  eau:          { label: 'Eau',           couleur: '#95C6D8' },
  soleil:       { label: 'Soleil',        couleur: '#E9C75F' },
  terre:        { label: 'Terre',         couleur: '#6C855A' },
  vent:         { label: 'Vent',          couleur: '#C1ECFD' },
  pollen:       { label: 'Pollen (joker)', couleur: '#CABFE3' },
  epine:        { label: 'Épine',         couleur: '#CF6B88' },
  vent_mauvais: { label: 'Vent mauvais',  couleur: '#8F77C7' },
  seve:         { label: 'Sève',          couleur: '#6C855A' },
  bouclier:     { label: 'Bouclier',      couleur: '#4F4473' },
  regard:       { label: 'Regard',        couleur: '#E9C75F' },
  ronce:        { label: 'Ronce',         couleur: '#CF6B88' },
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

  // Vent mauvais : annule aléatoirement une ressource correcte
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
      if (cible === 'eau')    eau--
      else if (cible === 'soleil') soleil--
      else if (cible === 'terre')  terre--
      else if (cible === 'vent')   vent--
    }
  }

  // Calcul des écarts après vent_mauvais
  const gapEau    = Math.max(0, requis.eau    - eau)
  const gapSoleil = Math.max(0, requis.soleil - soleil)
  const gapTerre  = Math.max(0, requis.terre  - terre)
  const gapVent   = Math.max(0, requis.vent   - vent)
  const gapPollen = requis.pollen  // slot pollen rempli par jokers
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

  // Effets négatifs
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
