<script setup lang="ts">
import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { NuxtLink } from '#components'
import { RoutePath } from '@/types'

const { signupGuest } = useAuth()
const router = useRouter()
const route = useRoute()
const redirectTarget = computed(() => {
  return typeof route.query.redirect === 'string'
    ? route.query.redirect
    : RoutePath.Dashboard
})

const formSchema = toTypedSchema(
  z.object({
    name: z.string(),
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
  const isSuccess = await signupGuest(values.name)

  if (isSuccess) {
    await navigateTo(redirectTarget.value)
  }
})
</script>

<template>
  <UiHeading>
    Join as Guest
  </UiHeading>
  <form
    class="space-y-4 text-foreground"
    @submit="onSubmit"
  >
    <FormField
      v-slot="{ componentField }"
      name="name"
      :validate-on-model-update="false"
      :validate-on-blur="false"
    >
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl>
          <Input
            type="text"
            v-bind="componentField"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button
      type="submit"
      size="sm"
      class="w-full"
    >
      Join
    </Button>
    <div>
      <UiText>
        Already a member?
        <Button
          size="link"
          variant="link"
          :as="NuxtLink"
          :to="{
            name: 'login',
            query: {
              redirect: route.query.redirect,
            },
          }"
        >
          Sign In
        </Button>
      </UiText>
    </div>
  </form>
</template>
