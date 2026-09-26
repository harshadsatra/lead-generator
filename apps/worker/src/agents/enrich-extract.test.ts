import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contactLinks, emailRank, extractEmails, pickEmail } from './enrich-extract'

test('extracts emails, decodes entities, drops junk', () => {
  const html = `<a href="mailto:Info@Laurels.co.uk">Email</a> sales&#64;laurels.co.uk
    <img src="logo@2x.png"> abc123@sentry.io noreply@laurels.co.uk
    <script>{"x":"0123456789abcdef0123@wixpress.com"}</script>`
  assert.deepEqual(extractEmails(html), ['info@laurels.co.uk', 'sales@laurels.co.uk'])
})

test('ranks own-domain role > own-domain person > free-mail; rejects other domains', () => {
  assert.equal(emailRank('info@laurels.co.uk', 'laurels.co.uk'), 0)
  assert.equal(emailRank('jane@laurels.co.uk', 'laurels.co.uk'), 1)
  assert.equal(emailRank('info@mail.laurels.co.uk', 'laurels.co.uk'), 0)
  assert.equal(emailRank('laurelsproperty@gmail.com', 'laurels.co.uk'), 2)
  assert.equal(emailRank('hello@webagency.com', 'laurels.co.uk'), null)
  const pick = pickEmail([
    { email: 'hello@webagency.com', url: 'a' },
    { email: 'laurels@gmail.com', url: 'b' },
    { email: 'jane@laurels.co.uk', url: 'c' },
    { email: 'lettings@laurels.co.uk', url: 'd' }
  ], 'laurels.co.uk')
  assert.equal(pick?.email, 'lettings@laurels.co.uk')
  assert.equal(pickEmail([{ email: 'hello@webagency.com', url: 'a' }], 'laurels.co.uk'), null)
})

test('finds same-site contact/about links', () => {
  const html = `<a href="/contact-us/">Contact</a><a href="https://laurels.co.uk/about">About us</a>
    <a href="https://facebook.com/contact">FB</a><a href="/blog">Blog</a><a href="/team">Get in touch</a><a href="#contact">x</a>`
  assert.deepEqual(contactLinks(html, 'https://laurels.co.uk/'), ['https://laurels.co.uk/contact-us/', 'https://laurels.co.uk/team'])
  // contact beats about even when about links come first
  assert.deepEqual(contactLinks('<a href="/about">About</a><a href="/about/org">Org</a><a href="/contact">Contact</a>', 'https://x.org/', 2), ['https://x.org/contact', 'https://x.org/about'])
})
