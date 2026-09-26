export default defineEventHandler(async (event) => {
  const c = await directusAsUser<{ reddit_watch: { subreddits?: string[], phrases?: string[] } | null }>(event, '/items/le_global_config', { query: { fields: 'reddit_watch' } })
  return { subreddits: c.reddit_watch?.subreddits ?? [], phrases: c.reddit_watch?.phrases ?? [], connected: !!process.env.REDDIT_CLIENT_ID }
})
