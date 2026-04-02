import { createClient } from '@/lib/supabase/server'

export async function getUserEmailByUsername(username: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('username', username)
    .single()
  return data?.email || null
}

export async function createUserProfile(
  id: string,
  username: string,
  email: string
) {
  const supabase = await createClient()
  return supabase.from('user_profiles').insert({ id, username, email })
}
