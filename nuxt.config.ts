// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['nuxt-icon', '@nuxt/ui'],
  runtimeConfig: {
    ai: {
      url: 'http://localhost:8000',
      token: '',
    },
    auth: {
      name: 'nuxt-session',
      password: 'my-super-secret-password-is-minimum-32-characters-long',
    },
    data_path: './data',
    public: {
      APP_URL: 'http://localhost:3000',
    },
  },
  ignore: ['data/**/*'],
  ui: {
    icons: ['mdi', 'simple-icons', 'heroicons', 'ion'],
  },
  app: {
    head: {
      title: 'CodeCaptain.ai',
      link: [
        { rel: 'alternate icon', type: 'image/png', href: '/logo.png' },
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
      ],
    },
  },
  typescript: {
    strict: true,
  },
});
