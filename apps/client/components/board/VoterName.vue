<script setup lang="ts">
const voterNameDraft = ref('')
const errorMessage = ref('')

const {
  closeVoterNameDialog,
  hydrateVoterName,
  isVoterNameDialogOpen,
  openVoterNameDialog,
  setVoterName,
  voterName,
} = useVoterName()

onMounted(() => {
  hydrateVoterName()
})

watch(isVoterNameDialogOpen, (isOpen) => {
  if (!isOpen)
    return

  voterNameDraft.value = voterName.value
  errorMessage.value = ''
})

function onSave() {
  const isSaved = setVoterName(voterNameDraft.value)

  if (!isSaved) {
    errorMessage.value = 'Please enter your name.'
    return
  }

  closeVoterNameDialog()
}
</script>

<template>
  <Button
    size="xs"
    variant="outline"
    class="h-7"
    @click="openVoterNameDialog"
  >
    Voting as: {{ voterName || 'Set name' }}
  </Button>

  <Dialog v-model:open="isVoterNameDialogOpen">
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>Set voting name</DialogTitle>
        <DialogDescription>
          This name is used to track your votes and reactions across devices.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-2">
        <Input
          v-model="voterNameDraft"
          placeholder="Your name"
          @keyup.enter="onSave"
        />
        <UiText
          v-if="errorMessage"
          size="xs"
          class="text-red-500"
        >
          {{ errorMessage }}
        </UiText>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="closeVoterNameDialog"
        >
          Cancel
        </Button>
        <Button @click="onSave">
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>