<script setup lang="ts">
import type { Emoji } from './types'
import { NOTE_KEY } from './types'
import { useBoard } from '@/components/board/composables'
import { SmilePlus } from 'lucide-vue-next'

const note = inject(NOTE_KEY)

const { getVoterNameOrPrompt, hydrateVoterName, voterName } = useVoterName()
const { updateNote } = useBoard()

const emojis: Emoji[] = [
  { name: 'thinking-face', value: '🤔' },
  { name: 'loudly-crying-face', value: '😭' },
  { name: 'face-with-tears-of-joy', value: '😂' },
  { name: 'fire', value: '🔥' },
  { name: 'party-popper', value: '🎉' },
  { name: 'pile-of-poo', value: '💩' },
]

const isOpen = ref(false)

const uniqEmojis = computed(() => new Set(note?.data.value.reactions.map(i => i.emoji)))

onMounted(() => {
  hydrateVoterName()
})

function onReaction(emoji: Emoji['name']) {
  if (!note?.data.value._id)
    return

  const activeVoterName = getVoterNameOrPrompt()

  if (!activeVoterName)
    return

  updateNote(note?.data.value._id, {
    reactions: emoji,
    voterName: activeVoterName,
  })

  isOpen.value = false
}

function isEmojiBelongsToUser(emoji: string) {
  return note?.data.value.reactions.some(i => i.emoji === emoji && i.voterName === voterName.value)
}

function reactionVoterNames(emoji: string) {
  const names = note?.data.value.reactions
    .filter(i => i.emoji === emoji)
    .map(i => i.voterName) ?? []

  return [...new Set(names)]
}
</script>

<template>
  <div
    data-note-emoji
    class="flex items-baseline gap-1"
  >
    <Popover v-model:open="isOpen">
      <PopoverTrigger as-child>
        <div class="flex items-center">
          <Button
            size="icon-sm"
            variant="ghost"
          >
            <SmilePlus class="w-3.5 h-3.5" />
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent class="w-[300px] p-2">
        <div class="flex gap-2">
          <div
            v-for="emoji in emojis"
            :key="emoji.name"
          >
            <Button
              size="icon"
              variant="ghost"
              class="text-xl"
              @click="onReaction(emoji.name)"
            >
              {{ emoji.value }}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
    <div class="flex flex-wrap gap-1 relative -top-[2px]">
      <TooltipProvider
        v-for="i in uniqEmojis"
        :key="i"
        :disable-hoverable-content="true"
      >
        <Tooltip>
          <TooltipTrigger
            as="div"
            class="border dark:border-slate-600 rounded-full px-1 py-[1px] cursor-pointer"
            :class="{ 'bg-primary-foreground border-primary dark:border-blue-500': isEmojiBelongsToUser(i!) }"
            @click="onReaction(i)"
          >
            {{ emojis.find(e => e.name === i)?.value }}
            <span class="tabular-nums">
              {{ note?.data.value.reactions.filter(r => r.emoji === i).length }}
            </span>
          </TooltipTrigger>
          <TooltipContent v-if="reactionVoterNames(i).length">
            <div
              v-for="name in reactionVoterNames(i)"
              :key="`${i}-${name}`"
              class="whitespace-nowrap"
            >
              {{ name }}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>
