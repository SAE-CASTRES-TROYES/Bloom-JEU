export function getNbRonces(nbJoueurs: number): number {
  if (nbJoueurs <= 4) return 1
  if (nbJoueurs <= 6) return 2
  return 3
}

export const DECK_COMPOSITIONS: Record<number, Record<string, number>> = {
  4: { ronce: 1, epine: 5, vent_mauvais: 2, seve: 3, bouclier: 2, regard: 2, eau: 7, soleil: 6, terre: 5, vent: 4, pollen: 3 },
  5: { ronce: 2, epine: 6, vent_mauvais: 2, seve: 4, bouclier: 2, regard: 2, eau: 9, soleil: 7, terre: 6, vent: 5, pollen: 4 },
  6: { ronce: 2, epine: 7, vent_mauvais: 3, seve: 4, bouclier: 3, regard: 2, eau: 10, soleil: 8, terre: 7, vent: 6, pollen: 5 },
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
