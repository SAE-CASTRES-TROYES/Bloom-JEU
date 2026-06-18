import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client navigateur basé sur les cookies (@supabase/ssr) : partage la session
// d'authentification avec le site WEB sur le même domaine. Permet de savoir si
// le joueur est connecté (auth.getUser) et d'attribuer ses stats à son compte.
// Reste 100 % fonctionnel pour un invité non connecté.
export const supabase = createBrowserClient(supabaseUrl, supabaseKey)
