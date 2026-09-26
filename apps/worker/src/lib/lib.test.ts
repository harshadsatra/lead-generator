import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvToObjects, parseCsv } from './csv'
import { firstEmail, mapColumns, parseCount, normalizePhone, normalizeWebsite } from './normalize'

test('csv: quotes, escaped quotes, embedded comma/newline, CRLF, BOM, blank lines', () => {
  const text = '﻿name,notes\r\n"Cafe, Bandra","say ""hi""\nthere"\r\n\r\nPlain,x\n'
  assert.deepEqual(parseCsv(text), [['name', 'notes'], ['Cafe, Bandra', 'say "hi"\nthere'], ['Plain', 'x']])
  assert.deepEqual(csvToObjects('a,b\n1\n'), [{ a: '1', b: '' }])
})

test('website normalisation', () => {
  assert.deepEqual(normalizeWebsite('https://www.Example.co.in/'), { url: 'https://www.example.co.in', domain: 'example.co.in', socialOnly: false })
  assert.equal(normalizeWebsite('example.com/menu').domain, 'example.com')
  assert.equal(normalizeWebsite('https://m.facebook.com/somecafe').socialOnly, true)
  assert.equal(normalizeWebsite('https://www.instagram.com/somecafe').domain, null)
  assert.equal(normalizeWebsite('n/a').domain, null)
  assert.equal(normalizeWebsite('').url, null)
})

test('phone normalisation', () => {
  assert.equal(normalizePhone('+91 98200 12345'), '9820012345')
  assert.equal(normalizePhone('098200 12345'), '9820012345')
  assert.equal(normalizePhone('022 2640 1234, 98200 12345'), '02226401234'.slice(-10))
  assert.equal(normalizePhone('123'), null)
})

test('review counts ignore ratings', () => {
  assert.equal(parseCount('120'), 120)
  assert.equal(parseCount('4.5 (120)'), 120)
  assert.equal(parseCount('1,234 reviews'), 1234)
  assert.equal(parseCount('4.5'), null)
  assert.equal(parseCount(undefined), null)
})

test('email + column mapping', () => {
  assert.equal(firstEmail('Info@Cafe.in; owner@cafe.in'), 'info@cafe.in')
  assert.equal(firstEmail('none'), null)
  assert.deepEqual(mapColumns(['Business Name', 'Website URL', 'Phone Number', 'Total Reviews', 'Google Maps URL', 'Random']), {
    name: 'Business Name', website: 'Website URL', phone: 'Phone Number', reviews: 'Total Reviews', sourceUrl: 'Google Maps URL'
  })
})
