import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toPlace } from './places'

test('maps a Places API (New) result', () => {
  const p = toPlace({
    id: 'ChIJabc',
    displayName: { text: 'Laurels Property Partners' },
    formattedAddress: '6 Flitcroft St, London WC2H 8DJ, UK',
    addressComponents: [
      { longText: 'Flitcroft Street', shortText: 'Flitcroft St', types: ['route'] },
      { longText: 'London', shortText: 'London', types: ['postal_town'] },
      { longText: 'United Kingdom', shortText: 'GB', types: ['country', 'political'] }
    ],
    nationalPhoneNumber: '020 8191 9595',
    internationalPhoneNumber: '+44 20 8191 9595',
    websiteUri: 'https://laurels.example/',
    rating: 4.9,
    userRatingCount: 320,
    primaryTypeDisplayName: { text: 'Real Estate Agency' },
    googleMapsUri: 'https://maps.google.com/?cid=1',
    businessStatus: 'OPERATIONAL'
  })
  assert.deepEqual(p, {
    placeId: 'ChIJabc', name: 'Laurels Property Partners', website: 'https://laurels.example/', phone: '+44 20 8191 9595',
    reviews: 320, rating: 4.9, address: '6 Flitcroft St, London WC2H 8DJ, UK', city: 'London', locality: null, country: 'GB',
    category: 'Real Estate Agency', mapsUrl: 'https://maps.google.com/?cid=1', closed: false
  })
  assert.equal(toPlace({ id: 'x', businessStatus: 'CLOSED_PERMANENTLY' }).closed, true)
  assert.equal(toPlace({ id: 'x' }).website, null)
  // Google sometimes omits `types` on an address component
  assert.equal(toPlace({ id: 'x', addressComponents: [{ longText: '?' }, { longText: 'Leeds', types: ['postal_town'] }] }).city, 'Leeds')
})
