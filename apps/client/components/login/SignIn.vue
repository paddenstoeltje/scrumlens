<script setup lang="ts">
import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { NuxtLink } from '#components'
import { RoutePath } from '@/types'

const { login } = useAuth()
const router = useRouter()
const route = useRoute()
const redirectTarget = computed(() => {
  return typeof route.query.redirect === 'string'
    ? route.query.redirect
    : RoutePath.Dashboard
})

const formSchema = toTypedSchema(
  z.object({
    email: z.string().email(),
    password: z.string(),
  }),
)

const { handleSubmit } = useForm({
  validationSchema: formSchema,
})

watch(
  () => useAuth().isAuth.value,
  (value) => {
    if (value)
      navigateTo(redirectTarget.value)
  },
  { immediate: true },
)

const onSubmit = handleSubmit(async (values) => {
  const isSuccess = await login(values)

  if (isSuccess) {
    await navigateTo(redirectTarget.value)
  }
})
</script>

<template>
  <UiHeading>
    Sign In
  </UiHeading>
  <form
    class="space-y-4 text-foreground"
    @submit="onSubmit"
  >
    <FormField
      v-slot="{ componentField }"
      name="email"
      :validate-on-model-update="false"
      :validate-on-blur="false"
    >
      <FormItem>
        <FormLabel>Email</FormLabel>
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
      >
        Sign In
      </Button>
    </FormItem>
    <div>
      <UiText>
        Don't have an account?
        <Button
          :as="NuxtLink"
          :to="{
            name: 'login',
            query: {
              type: 'signup',
              redirect: route.query.redirect,
            },
          }"
          size="link"
          variant="link"
        >
          Sign Up
        </Button>
        or
        <Button
          :as="NuxtLink"
          :to="{
            name: 'login',
            query: {
              type: 'signup-as-guest',
              redirect: route.query.redirect,
            },
          }"
          size="link"
          variant="link"
        >
          Join as Guest
        </Button>
      </UiText>
    </div>
  </form>
</template>
