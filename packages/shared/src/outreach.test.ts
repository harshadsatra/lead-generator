import { test } from 'node:test'
import assert from 'node:assert/strict'
import { whatsappDraft, whatsappLink } from './outreach'

test('WhatsApp draft names sender, business, finding, offer and opt-out', () => {
  const text = whatsappDraft({
    senderName: 'Harshad',
    businessName: 'Shivadnya Properties',
    hook: 'No website listed: customers searching online can only find the Google listing',
    service: 'Website + CRM integration'
  })
  assert.equal(text, 'Hi, this is Harshad from Shwez Studio. I came across Shivadnya Properties on Google Maps. One thing stood out: no website listed: customers searching online can only find the Google listing. We help businesses like yours with website + CRM integration. Would a quick 15-minute call this week be useful? Reply STOP and I won\'t message again.')
  assert.doesNotMatch(whatsappDraft({ senderName: 'H', businessName: 'X', hook: null, service: null }), /stood out|help businesses/)
})

test('wa.me link uses digits only and encodes the text', () => {
  assert.equal(whatsappLink('+91 98200 12345', 'Hi & bye'), 'https://wa.me/919820012345?text=Hi%20%26%20bye')
})
