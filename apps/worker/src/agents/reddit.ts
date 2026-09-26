// Reddit via the official API (application-only OAuth). Posts go to le_posts for a human to answer in-thread; no DMs.
import { api } from '../lib/db'
import { buildQuery, matchPhrase } from './reddit-match'

export const REDDIT_EVERY_MINUTES = 15
const MAX_AGE_DAYS = 7

export interface RedditPost { name: string, title: string, selftext: string, author: string, subreddit: string, created_utc: number, permalink: string }

const userAgent = () => `server:shwez-lead-engine:0.1 (by /u/${process.env.REDDIT_USERNAME ?? 'unknown'})`
let token: { value: string, expires: number } | null = null

async function accessToken() {
  if (token && token.expires > Date.now() + 60_000) return token.value
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent()
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(20_000)
  })
  const json = await res.json() as { access_token?: string, expires_in?: number, error?: string }
  if (!res.ok || !json.access_token) throw new Error(`Reddit auth failed: ${json.error ?? `HTTP ${res.status}`}`)
  token = { value: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 }
  return token.value
}

async function search(subreddit: string, phrases: string[]): Promise<RedditPost[]> {
  const q = new URLSearchParams({ q: buildQuery(phrases), restrict_sr: '1', sort: 'new', t: 'week', limit: '50', raw_json: '1' })
  const res = await fetch(`https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/search?${q}`, {
    headers: { 'Authorization': `Bearer ${await accessToken()}`, 'User-Agent': userAgent() },
    signal: AbortSignal.timeout(20_000)
  })
  if (!res.ok) throw new Error(`r/${subreddit}: HTTP ${res.status}`)
  const json = await res.json() as { data?: { children?: { data: RedditPost }[] } }
  return (json.data?.children ?? []).map(c => c.data)
}

export async function scanReddit(log: (msg: string) => void) {
  const { reddit_watch: watch } = await api<{ reddit_watch: { subreddits?: string[], phrases?: string[] } | null }>('GET', '/items/le_global_config?fields=reddit_watch')
  const subs = watch?.subreddits ?? []
  const phrases = watch?.phrases ?? []
  if (!subs.length || !phrases.length) return { added: 0 }
  const cutoff = Date.now() / 1000 - MAX_AGE_DAYS * 86_400
  let added = 0
  for (const sub of subs) {
    let posts: RedditPost[]
    try {
      posts = await search(sub, phrases)
    } catch (err) {
      log(`  ${(err as Error).message}`)
      continue
    }
    for (const p of posts) {
      const matched = matchPhrase(p, phrases)
      if (!matched || p.created_utc < cutoff || p.author === '[deleted]') continue
      const ok = await api('POST', '/items/le_posts', {
        source: 'reddit', external_id: p.name, url: `https://www.reddit.com${p.permalink}`, title: p.title.slice(0, 250),
        body: p.selftext.slice(0, 4000), author: p.author, community: `r/${p.subreddit}`,
        posted_at: new Date(p.created_utc * 1000).toISOString(), matched, status: 'new'
      }).then(() => true, (err: Error) => {
        if (!err.message.includes('RECORD_NOT_UNIQUE')) throw err
        return false
      })
      if (ok) added++
    }
  }
  return { added }
}
