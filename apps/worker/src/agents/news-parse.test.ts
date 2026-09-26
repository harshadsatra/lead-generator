import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fundingCompany, parseRss, sameCompany } from './news-parse'

test('parses RSS items with CDATA and entities', () => {
  const xml = `<rss><channel><title>Feed</title>
    <item><title><![CDATA[Dextr AI Raises $6.7 Mn To Build AI Agents]]></title><link>https://inc42.com/buzz/dextr/</link><pubDate>Fri, 26 Sep 2026 10:00:00 +0000</pubDate></item>
    <item><title>Tata &amp; Sons&#8217; Update</title><link>https://yourstory.com/x</link></item>
    <item><title>No link</title></item>
  </channel></rss>`
  assert.deepEqual(parseRss(xml), [
    { title: 'Dextr AI Raises $6.7 Mn To Build AI Agents', link: 'https://inc42.com/buzz/dextr/', published: '2026-09-26T10:00:00.000Z' },
    { title: 'Tata & Sons’ Update', link: 'https://yourstory.com/x', published: null }
  ])
})

test('extracts the funded company from headlines', () => {
  assert.equal(fundingCompany('Dextr AI Raises $6.7 Mn To Build AI Agents For Hospitality Industry'), 'Dextr AI')
  assert.equal(fundingCompany('Bengaluru-Based Fintech Startup Kiwi Raises $5 Mn In Seed Round'), 'Kiwi')
  assert.equal(fundingCompany('D2C Brand Snitch Bags ₹110 Cr In Series B'), 'Snitch')
  assert.equal(fundingCompany('Aequs To Raise ₹650 Cr Via Preferential Issue To Bolster Manufacturing Capacity'), 'Aequs')
  assert.equal(fundingCompany('[Funding alert] Per Annum secures Rs 20 Cr seed funding'), 'Per Annum')
  assert.equal(fundingCompany('Exclusive: CodeKarma In Talks To Raise $6 Mn From Prosus, Accel'), 'CodeKarma')
  assert.equal(fundingCompany('IPO-Bound AceVector Nets ₹189 Cr From Anchor Investors'), 'AceVector')
  // not funding / roundups / lists / VC funds / deals
  assert.equal(fundingCompany('IIT Madras, Unicorn India Ventures Mark First Close Of Fund I At ₹450 Cr'), null)
  assert.equal(fundingCompany('Akamai lands $11.6B cloud computing deal with Anthropic'), null)
  assert.equal(fundingCompany('From Ultraviolette Automotive To GalaxEye — Indian Startups Raised Over $203 Mn This Week'), null)
  assert.equal(fundingCompany('Ride-Hailing Fear: Inside Bharat Taxi Coercion Allegations In Gujarat'), null)
  assert.equal(fundingCompany('Zomato Gets Approval For New Warehouse'), null)
})

test('matches Maps results only when names clearly agree', () => {
  assert.equal(sameCompany('Dextr AI', 'Dextr AI Technologies Pvt Ltd'), true)
  assert.equal(sameCompany('Snitch', 'SNITCH'), true)
  assert.equal(sameCompany('Kiwi', 'Kiwi Fruit Stall'), true)
  assert.equal(sameCompany('Kiwi', 'The Kiwi Cafe'), false)
  assert.equal(sameCompany('Per Annum', 'Annum Consulting'), false)
  assert.equal(sameCompany('Rivet', 'Rivets India'), false)
  assert.equal(sameCompany('CodeKarma', 'CodeKarma Technologies Private Limited'), true)
  assert.equal(sameCompany('CodeKarma', 'Code Karma'), true)
})
