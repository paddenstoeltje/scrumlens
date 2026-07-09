<script setup lang="ts">
import { format } from 'date-fns'
import {
  BarChart2,
  CalendarDays,
  Columns2,
  Globe,
  GlobeLock,
  Lock,
  LockOpen,
  StickyNote,
  UsersRound,
} from 'lucide-vue-next'
import type { BoardsResponse } from '~/services/api/generated'

interface Props {
  data: BoardsResponse['items'][0]
}

const props = defineProps<Props>()

const { userRaw } = useUser()

const isUserOwner = computed(() => userRaw.value?._id === props.data.userId)
const isSystemAdmin = computed(() => userRaw.value?.teamId === 'admin')
const canManageBoard = computed(() => isUserOwner.value || isSystemAdmin.value)

const ownerLabel = computed(() => {
  if (props.data.ownerName)
    return props.data.ownerName

  if (isUserOwner.value)
    return userRaw.value?.name

  return undefined
})

const boardTitle = computed(() => {
  const title = props.data.title
  const owner = ownerLabel.value?.trim()

  if (!owner)
    return title

  const prefixedTitle = `${owner}: ${title}`

  return title.startsWith(`${owner}: `) ? title : prefixedTitle
})
</script>

<template>
  <div
    data-dashboard-card
    class="rounded-lg border p-3 relative hover:border-primary cursor-pointer transition-all"
  >
    <DashboardCardActions
      v-if="canManageBoard"
      :data="data"
      class="absolute top-2 right-2"
    />
    <UiHeading
      as="h3"
      size="sm"
      class="mb-0 mt-1"
    >
      {{ boardTitle }}
    </UiHeading>

    <div class="flex items-center gap-2 mt-3">
      <Lock
        v-if="data.isLocked"
        class="w-3.5 h-3.5 text-muted-foreground"
      />
      <LockOpen
        v-else
        class="w-3.5 h-3.5 text-muted-foreground"
      />
      <UiText size="sm">
        {{ data.isLocked ? 'Locked' : 'Unlocked' }}
      </UiText>
      <Globe
        v-if="data.accessPolicy === 'public'"
        class="w-3.5 h-3.5 text-muted-foreground"
      />
      <GlobeLock
        v-else
        class="w-3.5 h-3.5 text-muted-foreground"
      />
      <UiText size="sm">
        {{ data.accessPolicy === 'public' ? 'Public' : 'Private' }}
      </UiText>
      <CalendarDays class="w-3.5 h-3.5 text-muted-foreground" />
      <UiText
        size="sm"
      >
        {{ format(data.createdAt, 'dd.MM.yyyy') }}
      </UiText>
    </div>
    <div class="grid grid-cols-4 gap-3 bg-primary-foreground p-3 mt-3 text-xl">
      <div class="flex items-center gap-2">
        <Columns2 class="w-5 h-5 text-muted-foreground" />
        {{ data.columns.length }}
      </div>
      <div class="flex items-center gap-2">
        <UsersRound class="w-5 h-5 text-muted-foreground" />
        {{ data.participants.length }}
      </div>
      <div class="flex items-center gap-2">
        <StickyNote class="w-5 h-5 text-muted-foreground" />
        {{ data.notes.length }}
      </div>
      <div class="flex items-center gap-2">
        <BarChart2 class="w-5 h-5 text-muted-foreground" />
        {{ data.polls && data.polls.length || 0 }}
      </div>
    </div>
  </div>
</template>
