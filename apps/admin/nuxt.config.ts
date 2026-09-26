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
    public: {
      // Browser key for the map picker; restrict it to Maps JavaScript API + your site in Google Cloud
      googleMapsKey: ''
    },
    directusUrl: 'https://cms.shwezstudio.in',
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
