'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { SessionUser } from '@/lib/rbac'
import AdminTable from '@/components/admin/AdminTable'
import SetupChecklistBackLink from '@/components/SetupChecklistBackLink'
import { formatRelativeDate } from '@/lib/formatRelativeDate'
import { getUserInitials } from '@/lib/getUserInitials'
import { Badge, Button, ConfirmDialog } from '@/components/ui'
import AddUserDialog from './AddUserDialog'
import HandbookToggle from './HandbookToggle'
import MemberDetailPanel from './MemberDetailPanel'
import MemberFilterBar from './MemberFilterBar'
import MemberStatsRow from './MemberStatsRow'
import { computeMemberStats, filterMembers, sortMembers } from './memberTableUtils'
import { EMPTY_FILTERS, type Membership, type MemberFilters, type PendingAction, type SortKey, type SortState, type Surgery } from './types'

interface SurgeryUsersClientProps {
  surgery: Surgery
  user: SessionUser
  lastActiveData: Record<string, string | null>
  handbookEnabled: boolean
}

export default function SurgeryUsersClient({ surgery, user, lastActiveData, handbookEnabled }: SurgeryUsersClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<MemberFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' })
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedMembership, setSelectedMembership] = useState<Membership | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Keep the open detail panel in sync after router.refresh() delivers
  // fresh data — selectedMembership is a snapshot of a previous array.
  useEffect(() => {
    setSelectedMembership((current) =>
      current ? surgery.users.find((m) => m.id === current.id) ?? null : current
    )
  }, [surgery.users])

  const handleRemoveUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/s/${surgery.id}/members/${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('User removed')
        setSelectedMembership(null)
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Failed to remove user: ${error.error}`)
      }
    } catch (error) {
      console.error('Error removing user:', error)
      toast.error('Failed to remove user')
    }
  }

  const runPendingAction = async () => {
    if (!pendingAction) return
    setConfirmLoading(true)
    try {
      await handleRemoveUser(pendingAction.userId)
    } finally {
      setConfirmLoading(false)
      setPendingAction(null)
    }
  }

  const handleToggleAdminToolkitWrite = async (userId: string, nextValue: boolean) => {
    try {
      const response = await fetch(`/api/s/${surgery.id}/members/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminToolkitWrite: nextValue,
        }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Failed to update Practice Handbook write access: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating admin toolkit write:', error)
      toast.error('Failed to update Practice Handbook write access')
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
    () => computeMemberStats(surgery.users, lastActiveData, new Date()),
    [surgery.users, lastActiveData]
  )

  const visibleMembers = useMemo(
    () => sortMembers(filterMembers(surgery.users, filters, searchQuery, lastActiveData, new Date()), sort, lastActiveData),
    [surgery.users, filters, searchQuery, sort, lastActiveData]
  )

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    filters.adminsOnly ||
    filters.handbookOnly ||
    filters.activity !== 'all'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SetupChecklistBackLink surgeryId={surgery.id} />
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            User & access management — {surgery.name}
          </h1>
          <Button onClick={() => setShowAddModal(true)}>
            Add User
          </Button>
        </div>

        <MemberStatsRow stats={stats} />

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              Surgery Members
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage user access and roles within {surgery.name}. Click a member to view and edit their details.
            </p>
          </div>

          <MemberFilterBar
            search={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
            handbookEnabled={handbookEnabled}
            resultCount={visibleMembers.length}
            totalCount={surgery.users.length}
          />

          {/* Table - scroll container with always-visible scrollbar */}
          <AdminTable
            scrollContainerClassName="max-h-[65vh] overflow-y-auto"
            cellPadding="px-3"
            cellPaddingY="py-2.5"
            sort={sort}
            onSortChange={handleSortChange}
            columns={[
              {
                header: 'User',
                key: 'name',
                stickyLeft: true,
                sortable: true,
                render: (membership) => (
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600 flex-shrink-0">
                      {getUserInitials(membership.user.name, membership.user.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {membership.user.name || 'No name set'}
                        </span>
                        {membership.role === 'ADMIN' && (
                          <Badge color="green" size="sm" pill={false}>
                            Practice admin
                          </Badge>
                        )}
                        {membership.user.defaultSurgeryId === surgery.id && (
                          <span className="text-xs text-gray-400">Default</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">
                        {membership.user.email}
                      </div>
                    </div>
                  </div>
                ),
              },
              ...(handbookEnabled
                ? [
                    {
                      header: 'Permissions',
                      key: 'permissions',
                      render: (membership: Membership) => (
                        <div className="flex items-center gap-2">
                          <HandbookToggle membership={membership} onToggle={handleToggleAdminToolkitWrite} />
                          <span className="text-xs text-gray-400">
                            Handbook
                          </span>
                        </div>
                      ),
                    },
                  ]
                : []),
              {
                header: 'Last active',
                key: 'lastActive',
                sortable: true,
                render: (membership) => {
                  const lastActiveIso = lastActiveData[membership.user.id]
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
            rows={visibleMembers}
            emptyMessage={
              hasActiveFilters ? (
                <span className="inline-flex items-center gap-2">
                  No members match your search or filters.
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
                'No users found. Add your first user to get started.'
              )
            }
            rowKey={(membership) => membership.id}
            onRowClick={(membership) => setSelectedMembership(membership)}
          />
        </div>
      </main>

      <AddUserDialog
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        surgeryId={surgery.id}
      />

      <MemberDetailPanel
        membership={selectedMembership}
        surgeryId={surgery.id}
        surgeryName={surgery.name}
        handbookEnabled={handbookEnabled}
        lastActive={selectedMembership ? lastActiveData[selectedMembership.user.id] ?? null : null}
        onClose={() => setSelectedMembership(null)}
        onRequestConfirm={setPendingAction}
      />

      {/* Remove access confirmation */}
      <ConfirmDialog
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={runPendingAction}
        loading={confirmLoading}
        title="Remove access"
        message={
          pendingAction ? (
            <>
              Are you sure you want to remove{' '}
              <span className="font-medium">{pendingAction.email}</span> from{' '}
              {surgery.name}? Their account is kept — only their access to this
              surgery is removed.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Remove"
      />
    </div>
  )
}
