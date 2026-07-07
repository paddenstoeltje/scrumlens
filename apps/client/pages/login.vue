<script setup lang="ts">
import { computed, watch } from 'vue'
import { repository, version } from '../../../package.json'
import LogoSvg from '@/assets/svg/scrumlens-logo.svg'
import { RoutePath } from '@/types'

definePageMeta({
  layout: 'blank',
})

const year = new Date().getFullYear()

const { isAuth } = useAuth()
const route = useRoute()

const redirectTarget = computed(() => {
  return typeof route.query.redirect === 'string'
    ? route.query.redirect
    : RoutePath.Dashboard
})

watch(
  isAuth,
  (value) => {
    if (value)
      navigateTo(redirectTarget.value)
  },
  { immediate: true },
)
</script>

<template>
  <div
    data-login
    class="grid grid-cols-2 h-full"
  >
    <div class="flex-grow flex-shrink-0 flex items-center justify-center text-center dark:bg-slate-950 px-4">
      <div class="flex flex-col items-center">
        <LogoSvg
          class="h-9"
          :font-controlled="false"
        />
        <UiHeading
          size="md"
          class="mb-1"
        >
          Agile Retrospective Tool
        </UiHeading>
        <UiText>
          Retrospectives that actually move the needle.<br>
          Open-source, real-time, and designed to make your team's voice<br>heard loud and clear
        </UiText>
        <UiText class="text-muted-foreground text-xs text-center">
          © {{ year }} • Anton Reshetov <br> v{{ version }} • <a
            :href="repository"
            target="_blank"
            rel="noopener noreferrer"
            class="underline"
          >GitHub</a>
        </UiText>
      </div>
    </div>
    <div class="flex-grow flex-shrink-0 flex items-center justify-center bg-primary-foreground dark:bg-primary-foreground">
      <div class="w-[350px]">
        <LoginSignUp v-if="$route.query.type === 'signup'" />
        <LoginSignInGuest v-else-if="$route.query.type === 'signup-as-guest'" />
        <LoginTeamSignIn v-else />
      </div>
    </div>
  </div>
</template>