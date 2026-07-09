const VOTER_NAME_STORAGE_KEY = 'scrumlens:voter-name'

const voterName = useState<string>('voter-name', () => '')
const isVoterNameDialogOpen = useState<boolean>('voter-name-dialog-open', () => false)
const isVoterNameHydrated = useState<boolean>('voter-name-hydrated', () => false)

function hydrateVoterName() {
  if (!import.meta.client || isVoterNameHydrated.value)
    return

  const rawName = localStorage.getItem(VOTER_NAME_STORAGE_KEY) ?? ''
  const trimmedName = rawName.trim()

  voterName.value = trimmedName
  isVoterNameHydrated.value = true

  if (!trimmedName) {
    localStorage.removeItem(VOTER_NAME_STORAGE_KEY)
  }
}

function setVoterName(value: string) {
  const trimmedName = value.trim()

  if (!trimmedName)
    return false

  voterName.value = trimmedName

  if (import.meta.client) {
    localStorage.setItem(VOTER_NAME_STORAGE_KEY, trimmedName)
  }

  return true
}

function openVoterNameDialog() {
  hydrateVoterName()
  isVoterNameDialogOpen.value = true
}

function closeVoterNameDialog() {
  isVoterNameDialogOpen.value = false
}

function getVoterNameOrPrompt() {
  hydrateVoterName()

  if (!voterName.value) {
    openVoterNameDialog()
    return undefined
  }

  return voterName.value
}

export function useVoterName() {
  return {
    closeVoterNameDialog,
    getVoterNameOrPrompt,
    hydrateVoterName,
    isVoterNameDialogOpen,
    openVoterNameDialog,
    setVoterName,
    voterName,
  }
}