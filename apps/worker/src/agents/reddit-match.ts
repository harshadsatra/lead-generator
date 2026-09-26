export const buildQuery = (phrases: string[]) => phrases.map(p => `"${p.replace(/"/g, '')}"`).join(' OR ')

// Reddit search is fuzzy; keep only posts that really contain a watch phrase.
export function matchPhrase(post: { title: string, selftext: string }, phrases: string[]): string | null {
  const text = `${post.title}\n${post.selftext}`.toLowerCase()
  return phrases.find(p => text.includes(p.toLowerCase())) ?? null
}
