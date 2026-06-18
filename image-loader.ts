// Loader custom : sert l'image statique telle quelle en préfixant le basePath.
// L'optimiseur next/image gère mal le basePath ici (url sans /jeu → 400/404).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
export default function imageLoader({ src }: { src: string; width: number; quality?: number }) {
  return src.startsWith('/') ? `${basePath}${src}` : src
}
