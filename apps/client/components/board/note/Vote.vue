<script setup lang="ts">
import { MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-vue-next'
import { NOTE_KEY } from './types'
import { useBoard } from '@/components/board/composables'

const note = inject(NOTE_KEY)

const { updateNote } = useBoard()
const { getVoterNameOrPrompt, hydrateVoterName, voterName } = useVoterName()

onMounted(() => {
  hydrateVoterName()
})

function voteUp() {
  const activeVoterName = getVoterNameOrPrompt()

  if (!activeVoterName)
    return

  updateNote(note?.data.value._id!, { voteUp: true, voterName: activeVoterName })
}

function voteDown() {
  const activeVoterName = getVoterNameOrPrompt()

  if (!activeVoterName)
    return

  updateNote(note?.data.value._id!, { voteDown: true, voterName: activeVoterName })
}
</script>

<template>
  <div class="flex items-baseline">
    <Button
      size="xs"
      variant="ghost"
      class="flex gap-1"
      @click="voteUp"
    >
      <ThumbsUp
        class="w-3.5 h-3.5"
        :class="{ 'text-primary': note?.data.value.voteUp.includes(voterName || '') }"
      />
      <span class="tabular-nums">
        {{ note?.data.value.voteUp.length || 0 }}
      </span>
    </Button>
    <Button
      size="xs"
      variant="ghost"
      @click="voteDown"
    >
      <div class="flex items-center gap-1">
        <ThumbsDown
          class="w-3.5 h-3.5"
          :class="{ 'text-red-500': note?.data.value.voteDown.includes(voterName || '') }"
        />
        <span class="tabular-nums">
          {{ note?.data.value.voteDown.length || 0 }}
        </span>
      </div>
    </Button>
  </div>
</template>
