'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import AdminTable from '@/components/admin/AdminTable'
import NavigationPanelTrigger from '@/components/NavigationPanelTrigger'
import LogoSizeControl from '@/components/LogoSizeControl'
import { formatRelativeDate } from '@/lib/formatRelativeDate'
import { Badge, Button, ConfirmDialog } from '@/components/ui'
import CreateUserDialog from './CreateUserDialog'
import UserDetailPanel from './UserDetailPanel'
import UserFilterBar from './UserFilterBar'
import UserStatsRow from './UserStatsRow'
import { computeStats, filterUsers, getUserInitials, sortUsers } from './userTableUtils'
import { EMPTY_FILTERS, type PendingAction, type SortKey, type SortState, type Surgery, type User, type UserFilters } from './types'

interface GlobalUsersClientProps {
  users: User[]
  surgeries: Surgery[]
  lastActiveData: Record<string, string | null>
}

export default function GlobalUsersClient({ users, surgeries, lastActiveData }: GlobalUsersClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<UserFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' })
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Keep the open detail panel in sync after router.refresh() delivers
  // fresh data — selectedUser is a snapshot of a previous `users` array.
  useEffect(() => {
    setSelectedUser((current) =>
      current ? users.find((u) => u.id === current.id) ?? null : current
    )
  }, [users])

  const handleResetTestUserUsage = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/test-users/reset-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (response.ok) {
        toast.success('Test user usage reset')
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Error resetting usage: ${error.error}`)
      }
    } catch (error) {
      console.error('Error resetting usage:', error)
      toast.error('Failed to reset usage. Please try again.')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('User deleted')
        setSelectedUser(null)
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Error deleting user: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user. Please try again.')
    }
  }

  const handleRemoveMembership = async (userId: string, membershipId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/memberships/${membershipId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Surgery membership removed')
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Error removing membership: ${error.error}`)
      }
    } catch (error) {
      console.error('Error removing membership:', error)
      toast.error('Failed to remove membership. Please try again.')
    }
  }

  const runPendingAction = async () => {
    if (!pendingAction) return
    setConfirmLoading(true)
    try {
      if (pendingAction.type === 'reset-usage') {
        await handleResetTestUserUsage(pendingAction.userId)
      } else if (pendingAction.type === 'delete-user') {
        await handleDeleteUser(pendingAction.userId)
      } else {
        await handleRemoveMembership(pendingAction.userId, pendingAction.membershipId)
      }
    } finally {
      setConfirmLoading(false)
      setPendingAction(null)
    }
  }

  const handleSortChange = (key: string) => {
    const sortKey = key as SortKey
    setSort((current) => {
      if (current.key === sortKey) {
        return { key: sortKey, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      }
      // Most-recent-first is the useful default when switching to last active
      return { key: sortKey, direction: sortKey === 'lastActive' ? 'desc' : 'asc' }
    })
  }

  const stats = useMemo(
    () => computeStats(users, lastActiveData, new Date()),
    [users, lastActiveData]
  )

  const visibleUsers = useMemo(
    () => sortUsers(filterUsers(users, filters, searchQuery, lastActiveData, new Date()), sort, lastActiveData),
    [users, filters, searchQuery, sort, lastActiveData]
  )

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    filters.adminsOnly ||
    filters.testOnly ||
    filters.noSurgeries ||
    filters.activity !== 'all'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - consistent with SimpleHeader */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Navigation Trigger + Logo */}
            <div className="flex items-center">
              <NavigationPanelTrigger className="mr-3" />
              <Link href="/s" className="flex items-center">
                <img
                  src="/images/signposting_logo_head.png"
                  alt="Signposting"
                  style={{ height: 'var(--logo-height, 58px)' }}
                  className="w-auto"
                />
              </Link>
              <LogoSizeControl />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Global Users
          </h1>
          <Button onClick={() => setShowCreateModal(true)}>
            Create User
          </Button>
        </div>

        <UserStatsRow stats={stats} />

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              All Users
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage user accounts and their global roles across the system. Click a user to view and edit their details.
            </p>
          </div>

          <UserFilterBar
            search={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={visibleUsers.length}
            totalCount={users.length}
          />

          {/* Table - scroll container with always-visible scrollbar */}
          <AdminTable
            cellPadding="px-3"
            cellPaddingY="py-2.5"
            scrollContainerClassName="max-h-[65vh] overflow-y-auto"
            sort={sort}
            onSortChange={handleSortChange}
            columns={[
              {
                header: 'User',
                key: 'name',
                stickyLeft: true,
                sortable: true,
                render: (user) => (
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600 flex-shrink-0">
                      {getUserInitials(user.name, user.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {user.name || 'No name set'}
                        </span>
                        {user.globalRole === 'SUPERUSER' && (
                          <Badge color="purple" size="sm" pill={false}>
                            System admin
                          </Badge>
                        )}
                        {user.isTestUser && (
                          <Badge color="amber" size="sm" pill={false}>
                            Test
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                header: 'Surgeries',
                key: 'memberships',
                className: 'align-middle',
                render: (user) => (
                  <div className="py-1">
                    {user.memberships.length === 0 ? (
                      <span className="text-xs text-gray-300 italic">None</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {user.memberships.slice(0, 3).map((membership) => (
                          <Badge
                            key={membership.id}
                            color={membership.role === 'ADMIN' ? 'blue' : 'gray'}
                            size="sm"
                          >
                            {membership.surgery.name}
                            {membership.role === 'ADMIN' && <span className="ml-1 font-normal">· admin</span>}
                          </Badge>
                        ))}
                        {user.memberships.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{user.memberships.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                header: 'Last active',
                key: 'lastActive',
                sortable: true,
                render: (user) => {
                  const lastActiveIso = lastActiveData[user.id]
                  return lastActiveIso ? (
                    <span className="text-sm text-gray-500">
                      {formatRelativeDate(new Date(lastActiveIso))}
                    </span>
                  ) : (
                    <span className="text-sm text-amber-600">Never</span>
                  )
                },
              },
              {
                header: '',
                key: 'open',
                className: 'w-8 text-right',
                render: () => (
                  <span aria-hidden="true" className="text-gray-300 group-hover:text-gray-500 text-lg">
                    ›
                  </span>
                ),
              },
            ]}
            rows={visibleUsers}
            emptyMessage={
              hasActiveFilters ? (
                <span className="inline-flex items-center gap-2">
                  No users match your search or filters.
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('')
                      setFilters(EMPTY_FILTERS)
                    }}
                  >
                    Clear filters
                  </Button>
                </span>
              ) : (
                'No users found.'
              )
            }
            rowKey={(user) => user.id}
            onRowClick={(user) => setSelectedUser(user)}
          />
        </div>
      </main>

      <CreateUserDialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        surgeries={surgeries}
      />

      <UserDetailPanel
        user={selectedUser}
        surgeries={surgeries}
        lastActive={selectedUser ? lastActiveData[selectedUser.id] ?? null : null}
        onClose={() => setSelectedUser(null)}
        onRequestConfirm={setPendingAction}
      />

      {/* Destructive action confirmation */}
      <ConfirmDialog
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={runPendingAction}
        loading={confirmLoading}
        title={
          pendingAction?.type === 'delete-user'
            ? 'Delete user'
            : pendingAction?.type === 'remove-membership'
              ? 'Remove surgery membership'
              : 'Reset usage count'
        }
        message={
          pendingAction?.type === 'delete-user' ? (
            <>
              Are you sure you want to delete user{' '}
              <span className="font-medium">{pendingAction.email}</span>? This action
              cannot be undone.
            </>
          ) : pendingAction?.type === 'remove-membership' ? (
            'Are you sure you want to remove this surgery membership?'
          ) : (
            "Are you sure you want to reset this test user's usage count?"
          )
        }
        confirmLabel={
          pendingAction?.type === 'delete-user'
            ? 'Delete user'
            : pendingAction?.type === 'remove-membership'
              ? 'Remove'
              : 'Reset'
        }
        variant={pendingAction?.type === 'reset-usage' ? 'primary' : 'danger'}
      />
    </div>
  )
}
