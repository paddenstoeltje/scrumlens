<script setup lang="ts">
import { ref } from 'vue'
import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { RoutePath } from '@/types'

const { fixedLogin, logout, isAuth } = useAuth()
const router: ReturnType<typeof useRouter> = useRouter()
const route: ReturnType<typeof useRoute> = useRoute()
const redirectTarget = computed(() => {
  return typeof route.query.redirect === 'string'
    ? route.query.redirect
    : RoutePath.Dashboard
})

const formSchema = toTypedSchema(
  z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  }),
)

const { handleSubmit, resetForm } = useForm({
  validationSchema: formSchema,
})

const isLoading = ref<boolean>(false)

watch(
  isAuth,
  (value) => {
    if (value)
      navigateTo(redirectTarget.value)
  },
  { immediate: true },
)

const onSubmit = handleSubmit(async (values: { username: string; password: string }) => {
  isLoading.value = true
  try {
    const isSuccess: boolean = await fixedLogin(values.username, values.password)
    if (isSuccess) {
      await navigateTo(redirectTarget.value)
    }
  } finally {
    isLoading.value = false
  }
})

const onLogout = async (): Promise<void> => {
  await logout()
}
</script>

<template>
  <UiHeading>
    Login
  </UiHeading>
  <p class="text-muted-foreground text-sm mb-4">
    Enter your username and password to access the retrospective board.
  </p>
  <form
    class="space-y-4 text-foreground"
    @submit="onSubmit"
  >
    <FormField
      v-slot="{ componentField }"
      name="username"
      :validate-on-model-update="false"
      :validate-on-blur="false"
    >
      <FormItem>
        <FormLabel>Username</FormLabel>
        <FormControl>
          <Input
            type="text"
            v-bind="componentField"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField
      v-slot="{ componentField }"
      name="password"
      :validate-on-model-update="false"
      :validate-on-blur="false"
    >
      <FormItem>
        <FormLabel>Password</FormLabel>
        <FormControl>
          <Input
            type="password"
            v-bind="componentField"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormItem>
      <Button
        type="submit"
        size="sm"
        class="w-full"
        :disabled="isLoading"
      >
        {{ isLoading ? 'Signing in...' : 'Sign In' }}
      </Button>
    </FormItem>
  </form>

  <!-- Admin quick actions -->
  <div v-if="isAuth" class="mt-4 space-y-2">
    <UiText class="text-xs text-muted-foreground">
      Currently logged in.
    </UiText>
    <Button
      variant="outline"
      size="sm"
      class="w-full"
      @click="onLogout"
    >
      Logout
    </Button>
  </div>
</template>