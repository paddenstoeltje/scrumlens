<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next'
import { api } from '~/services/api'
import type { AdminUsersResponse, UsersMeResponse } from '~/services/api/generated'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/components/ui/shadcn/toast/use-toast'

definePageMeta({
  middleware: async () => {
    const { isAuth, userRaw } = useAuth()
    if (!isAuth.value || userRaw.value?.role !== 'admin') {
      return '/login'
    }
  },
})

const { toast } = useToast()
const { userRaw } = useAuth()

// State
const users = ref<UsersMeResponse[]>([])
const loading = ref(false)
const searchQuery = ref('')
const currentPage = ref(1)
const limit = ref(20)
const total = ref(0)
const totalPages = ref(0)

// Filters
const filterRole = ref('')
const filterTeamId = ref('')

// Modal state
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteConfirm = ref(false)
const selectedUser = ref<UsersMeResponse | null>(null)

// Form data
const formData = ref({
  name: '',
  email: '',
  password: '',
  teamId: 'team1',
  role: 'editor' as 'admin' | 'viewer' | 'editor',
})

const editFormData = ref({
  name: '',
  email: '',
  password: '',
  teamId: 'team1',
  role: 'editor' as 'admin' | 'viewer' | 'editor',
  isActive: true,
})

// Team options for dropdown
const teamOptions = computed(() => {
  const options = [{ value: 'none', label: 'No Team' }]
  for (let i = 1; i <= 24; i++) {
    options.push({ value: `team${i}`, label: `Team ${i}` })
  }
  return options
})

// Role labels
const roleLabels: Record<string, string> = {
  admin: 'Admin',
  viewer: 'Viewer',
  editor: 'Editor',
}

const roleColors: Record<string, string> = {
  admin: 'border-red-200 bg-red-100 text-red-800',
  viewer: 'border-green-200 bg-green-100 text-green-800',
  editor: 'border-blue-200 bg-blue-100 text-blue-800',
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)

  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatTeam(teamId?: string) {
  if (!teamId) return 'No Team'
  return teamId.replace('team', 'Team ')
}

// Fetch users
async function fetchUsers() {
  loading.value = true
  try {
    const query: any = {
      limit: String(limit.value),
      page: String(currentPage.value),
    }
    if (searchQuery.value) query.search = searchQuery.value
    if (filterRole.value && filterRole.value !== 'all') query.role = filterRole.value
    if (filterTeamId.value && filterTeamId.value !== 'all') query.teamId = filterTeamId.value

    const response = await api.adminUsers.getAdminUsers(query)
    const data = response.data as AdminUsersResponse
    users.value = data.users
    total.value = data.pagination.total
    totalPages.value = data.pagination.pages
  } catch (error) {
    console.error('Failed to fetch users:', error)
    toast({
      title: 'Error',
      description: 'Failed to load users.',
      variant: 'destructive',
    })
  } finally {
    loading.value = false
  }
}

// Search
function handleSearch() {
  currentPage.value = 1
  fetchUsers()
}

// Page change
function setPage(page: number) {
  currentPage.value = page
  fetchUsers()
}

// Create user
async function createUser() {
  loading.value = true
  try {
    const payload = {
      ...formData.value,
      teamId: formData.value.teamId === 'none' ? undefined : formData.value.teamId,
    }
    await api.adminUsers.postAdminUsers(payload)
    showCreateModal.value = false
    toast({
      title: 'Success',
      description: `User ${formData.value.name} created successfully.`,
    })
    fetchUsers()
  } catch (error: any) {
    console.error('Failed to create user:', error)
    toast({
      title: 'Error',
      description: error?.error?.message || 'Failed to create user.',
      variant: 'destructive',
    })
  } finally {
    loading.value = false
  }
}

// Edit user
function openEditModal(user: UsersMeResponse) {
  selectedUser.value = user
  editFormData.value = {
    name: user.name,
    email: user.email,
    password: '',
    teamId: user.teamId || 'none',
    role: (user.role as 'admin' | 'viewer' | 'editor') || 'editor',
    isActive: user.isActive,
  }
  showEditModal.value = true
}

async function updateUser() {
  if (!selectedUser.value) return
  loading.value = true
  try {
    const updateData: any = {
      ...editFormData.value,
      teamId: editFormData.value.teamId === 'none' ? undefined : editFormData.value.teamId,
    }
    // Don't send empty password
    if (!updateData.password) delete updateData.password
    
    await api.adminUsers.putAdminUsersById(selectedUser.value._id, updateData)
    showEditModal.value = false
    toast({
      title: 'Success',
      description: `User ${editFormData.value.name} updated successfully.`,
    })
    fetchUsers()
  } catch (error: any) {
    console.error('Failed to update user:', error)
    toast({
      title: 'Error',
      description: error?.error?.message || 'Failed to update user.',
      variant: 'destructive',
    })
  } finally {
    loading.value = false
  }
}

// Delete user
function openDeleteConfirm(user: UsersMeResponse) {
  selectedUser.value = user
  showDeleteConfirm.value = true
}

async function deleteUser() {
  if (!selectedUser.value) return
  loading.value = true
  try {
    await api.adminUsers.deleteAdminUsersById(selectedUser.value._id)
    showDeleteConfirm.value = false
    toast({
      title: 'Success',
      description: `User ${selectedUser.value.name} deleted successfully.`,
    })
    fetchUsers()
  } catch (error: any) {
    console.error('Failed to delete user:', error)
    toast({
      title: 'Error',
      description: error?.error?.message || 'Failed to delete user.',
      variant: 'destructive',
    })
  } finally {
    loading.value = false
  }
}

// Reset password
function openPasswordReset(user: UsersMeResponse) {
  selectedUser.value = user
  resetPassword()
}

async function resetPassword() {
  if (!selectedUser.value) return
  const newPassword = prompt('Enter new password for ' + selectedUser.value.name + ':')
  if (!newPassword) return
  
  loading.value = true
  try {
    await api.adminUsers.postAdminUsersByIdResetPassword(selectedUser.value._id, {
      newPassword,
    })
    toast({
      title: 'Success',
      description: 'Password reset successfully.',
    })
  } catch (error: any) {
    console.error('Failed to reset password:', error)
    toast({
      title: 'Error',
      description: error?.error?.message || 'Failed to reset password.',
      variant: 'destructive',
    })
  } finally {
    loading.value = false
  }
}

// Generate random password
function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Apply generated password
function applyGeneratedPassword() {
  formData.value.password = generatePassword()
}

// Reset form
function resetForm() {
  formData.value = {
    name: '',
    email: '',
    password: '',
    teamId: 'none',
    role: 'editor',
  }
}

// Apply filter
function applyFilter() {
  currentPage.value = 1
  fetchUsers()
}

// Clear filters
function clearFilters() {
  searchQuery.value = ''
  filterRole.value = 'all'
  filterTeamId.value = 'all'
  currentPage.value = 1
  fetchUsers()
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div class="container mx-auto max-w-7xl space-y-6 p-4 md:p-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">User Management</h1>
        <p class="mt-1 text-muted-foreground">
          Manage users across all teams with role and status controls.
        </p>
      </div>
      <Button class="gap-2" @click="showCreateModal = true; resetForm()">
        <Plus class="h-4 w-4" />
        Add User
      </Button>
    </div>

    <!-- Filters -->
    <Card class="border-muted/50 bg-gradient-to-br from-background to-muted/20">
      <CardHeader class="pb-4">
        <CardTitle class="text-lg">Filters</CardTitle>
        <CardDescription>
          Search and narrow the list by role or team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            v-model="searchQuery"
            placeholder="Search by name or email..."
            @keyup.enter="handleSearch"
          />
          <Select v-model="filterRole">
            <SelectTrigger>
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterTeamId">
            <SelectTrigger>
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              <SelectItem v-for="team in teamOptions.filter(t => t.value)" :key="team.value" :value="team.value">
                {{ team.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div class="flex gap-2 md:justify-end">
            <Button variant="outline" @click="applyFilter">Apply</Button>
            <Button variant="ghost" @click="clearFilters">Clear</Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Users Table -->
    <Card>
      <CardHeader class="pb-3">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle class="text-lg">Users</CardTitle>
            <CardDescription>
              {{ total }} total users{{ totalPages > 1 ? ` across ${totalPages} pages` : '' }}
            </CardDescription>
          </div>
          <Badge variant="outline" class="w-fit">
            Page {{ currentPage }}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div v-if="loading" class="flex justify-center py-8">
          <LoaderCircle class="h-6 w-6 animate-spin" />
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="users.length === 0">
              <TableCell colspan="6" class="text-center py-8 text-muted-foreground">
                No users found. Click "Add User" to create one.
              </TableCell>
            </TableRow>
            <TableRow v-for="user in users" :key="user._id">
              <TableCell>
                <div class="flex items-center gap-3">
                  <div class="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                    {{ getInitials(user.name) }}
                  </div>
                  <div class="flex min-w-0 flex-col">
                    <span class="truncate font-medium">{{ user.name }}</span>
                    <span class="truncate text-xs text-muted-foreground">{{ user._id }}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell class="font-mono text-xs sm:text-sm">{{ user.email }}</TableCell>
              <TableCell>
                <Badge variant="outline">{{ formatTeam(user.teamId) }}</Badge>
              </TableCell>
              <TableCell>
                <Badge :class="roleColors[user.role || 'editor']" variant="outline">
                  {{ roleLabels[user.role || 'editor'] }}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  :class="user.isActive ? 'border-green-200 bg-green-100 text-green-800' : 'border-gray-200 bg-gray-100 text-gray-700'"
                >
                  {{ user.isActive ? 'Active' : 'Inactive' }}
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" class="h-8 gap-1 px-2" @click="openEditModal(user)">
                    <Pencil class="h-4 w-4" />
                    <span class="hidden lg:inline">Edit</span>
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 gap-1 px-2" @click="openPasswordReset(user)">
                    <KeyRound class="h-4 w-4" />
                    <span class="hidden lg:inline">Reset</span>
                  </Button>
                  <Button 
                    v-if="userRaw?._id !== user._id" 
                    variant="ghost" 
                    size="sm" 
                    class="h-8 gap-1 px-2 text-destructive hover:text-destructive"
                    @click="openDeleteConfirm(user)"
                  >
                    <Trash2 class="h-4 w-4" />
                    <span class="hidden lg:inline">Delete</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === 1"
            @click="setPage(currentPage - 1)"
          >
            Previous
          </Button>
          <span class="flex items-center px-4">
            Page {{ currentPage }} of {{ totalPages }} ({{ total }} total)
          </span>
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === totalPages"
            @click="setPage(currentPage + 1)"
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Create User Modal -->
    <Dialog v-model:open="showCreateModal">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label>Name</Label>
            <Input v-model="formData.name" placeholder="John Doe" />
          </div>
          <div class="space-y-2">
            <Label>Email</Label>
            <Input v-model="formData.email" type="email" placeholder="john@example.com" />
          </div>
          <div class="space-y-2">
            <Label>Password</Label>
            <div class="flex gap-2">
              <Input v-model="formData.password" type="password" placeholder="Enter password..." />
              <Button variant="outline" @click="applyGeneratedPassword" title="Generate random password">
                <RefreshCw class="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div class="space-y-2">
            <Label>Team</Label>
            <Select v-model="formData.teamId">
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="team in teamOptions" :key="team.value" :value="team.value || ''">
                  {{ team.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>Role</Label>
            <Select v-model="formData.role">
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateModal = false; resetForm()">Cancel</Button>
          <Button @click="createUser">Create User</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit User Modal -->
    <Dialog v-model:open="showEditModal">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label>Name</Label>
            <Input v-model="editFormData.name" placeholder="Name" />
          </div>
          <div class="space-y-2">
            <Label>Email</Label>
            <Input v-model="editFormData.email" type="email" placeholder="Email" />
          </div>
          <div class="space-y-2">
            <Label>New Password (leave blank to keep current)</Label>
            <Input v-model="editFormData.password" type="password" placeholder="New password..." />
          </div>
          <div class="space-y-2">
            <Label>Team</Label>
            <Select v-model="editFormData.teamId">
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="team in teamOptions" :key="team.value" :value="team.value || ''">
                  {{ team.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>Role</Label>
            <Select v-model="editFormData.role">
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox 
              id="isActive" 
              :checked="editFormData.isActive" 
              @update:checked="(v: boolean) => editFormData.isActive = v" 
            />
            <Label for="isActive">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEditModal = false">Cancel</Button>
          <Button @click="updateUser">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Modal -->
    <Dialog v-model:open="showDeleteConfirm">
      <DialogContent>
        <DialogHeader>
          <DialogTitle class="text-destructive">Delete User</DialogTitle>
        </DialogHeader>
        <p class="py-4">
          Are you sure you want to delete <strong>{{ selectedUser?.name }}</strong>? This action cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteConfirm = false">Cancel</Button>
          <Button variant="destructive" @click="deleteUser">Delete User</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>