<script setup lang="ts">
import { z } from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: false })

const route = useRoute()
const { fetch: refreshSession } = useUserSession()

const needOtp = ref(false)
const error = ref('')
const loading = ref(false)

const fields = computed<AuthFormField[]>(() => [
  { name: 'email', type: 'email', label: 'Email', placeholder: 'you@shwezstudio.in', required: true },
  { name: 'password', type: 'password', label: 'Password', required: true },
  ...(needOtp.value
    ? [{ name: 'otp', type: 'text', label: 'Authenticator code', inputmode: 'numeric', autocomplete: 'one-time-code', required: true } as AuthFormField]
    : [])
])

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
  otp: z.string().optional()
})

async function onSubmit(event: FormSubmitEvent<z.output<typeof schema>>) {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: event.data })
    await refreshSession()
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') && !route.query.redirect.startsWith('//')
      ? route.query.redirect
      : '/'
    await navigateTo(redirect)
  } catch (err) {
    const data = (err as { data?: { message?: string, data?: { otpRequired?: boolean } } }).data
    if (data?.data?.otpRequired) needOtp.value = true
    error.value = data?.message ?? 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh flex items-center justify-center p-4">
    <UPageCard class="w-full max-w-sm">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        :loading="loading"
        :submit="{ label: 'Sign in' }"
        icon="i-lucide-radar"
        title="Shwez Lead Engine"
        description="Sign in with your cms.shwezstudio.in account."
        @submit="onSubmit"
      >
        <template v-if="error" #validation>
          <UAlert color="error" icon="i-lucide-circle-alert" :title="error" />
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
