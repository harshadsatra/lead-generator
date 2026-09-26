// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    directusUrl: 'https://cms.shwezstudio.in',
    // dev reads GOOGLE_PLACES_API_KEY from the repo .env; in production set NUXT_GOOGLE_PLACES_API_KEY
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? '',
    session: {
      maxAge: 60 * 60 * 24 * 7
    }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
