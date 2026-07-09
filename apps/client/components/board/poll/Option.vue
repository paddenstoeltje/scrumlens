<script setup lang="ts">
import type { BoardResponse } from '~/services/api/generated'

const props = defineProps<Props>()

const { hydrateVoterName, voterName } = useVoterName()

interface Props {
  title: string
  data: BoardResponse['polls'][0]['options'][0]
  percent: number
}

onMounted(() => {
  hydrateVoterName()
})

const isUserVoted = computed(() => Boolean(voterName.value) && props.data.vote.includes(voterName.value))
const voteNames = computed(() => [...new Set(props.data.vote)])
</script>

<template>
  <div
    data-board-poll-option
    class="group flex items-center gap-2 text-sm cursor-pointer"
  >
    <div
      class="border rounded-md flex-grow p-1 relative"
    >
      <div
        class="z-10 relative [&.is-voted]:text-blue-500"
        :class="{ 'is-voted': isUserVoted }"
      >
        {{ data.title }}
      </div>
      <div
        class="absolute inset-0 bg-slate-100 dark:bg-slate-800 z-0 transition-all duration-300"
        :style="{
          width: `${percent}%`,
        }"
      />
    </div>
    <TooltipProvider :disable-hoverable-content="true">
      <Tooltip>
        <TooltipTrigger as="div" class="tabular-nums w-10 shrink-0">
          {{ percent.toFixed(0) }}%
        </TooltipTrigger>
        <TooltipContent v-if="voteNames.length">
          <div
            v-for="name in voteNames"
            :key="name"
            class="whitespace-nowrap"
          >
            {{ name }}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>
