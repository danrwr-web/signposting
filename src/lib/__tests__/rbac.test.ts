import { can, PermissionChecker } from '@/lib/rbac'
import { SessionUser } from '@/lib/rbac'

describe('RBAC Utilities', () => {
  describe('PermissionChecker', () => {
    const superuser: SessionUser = {
      id: '1',
      email: 'superuser@example.com',
      name: 'Super User',
      globalRole: 'SUPERUSER',
      defaultSurgeryId: 'surgery1',
      memberships: [
        { surgeryId: 'surgery1', role: 'ADMIN' },
        { surgeryId: 'surgery2', role: 'STANDARD' }
      ]
    }

    const admin: SessionUser = {
      id: '2',
      email: 'admin@example.com',
      name: 'Admin User',
      globalRole: 'USER',
      defaultSurgeryId: 'surgery1',
      memberships: [
        { surgeryId: 'surgery1', role: 'ADMIN' },
        { surgeryId: 'surgery2', role: 'STANDARD' }
      ]
    }

    const standardUser: SessionUser = {
      id: '3',
      email: 'user@example.com',
      name: 'Standard User',
      globalRole: 'USER',
      defaultSurgeryId: 'surgery1',
      memberships: [
        { surgeryId: 'surgery1', role: 'STANDARD' }
      ]
    }

    describe('manageGlobal', () => {
      it('should return true for superuser', () => {
        expect(can(superuser).manageGlobal()).toBe(true)
      })

      it('should return false for non-superuser', () => {
        expect(can(admin).manageGlobal()).toBe(false)
        expect(can(standardUser).manageGlobal()).toBe(false)
      })
    })

    describe('manageSurgery', () => {
      it('should return true for superuser regardless of surgery', () => {
        expect(can(superuser).manageSurgery('surgery1')).toBe(true)
        expect(can(superuser).manageSurgery('surgery2')).toBe(true)
        expect(can(superuser).manageSurgery('surgery3')).toBe(true)
      })

      it('should return true for admin of the surgery', () => {
        expect(can(admin).manageSurgery('surgery1')).toBe(true)
      })

      it('should return false for admin of different surgery', () => {
        expect(can(admin).manageSurgery('surgery2')).toBe(false)
      })

      it('should return false for standard user', () => {
        expect(can(standardUser).manageSurgery('surgery1')).toBe(false)
      })
    })

    describe('viewSurgery', () => {
      it('should return true for superuser regardless of surgery', () => {
        expect(can(superuser).viewSurgery('surgery1')).toBe(true)
        expect(can(superuser).viewSurgery('surgery2')).toBe(true)
        expect(can(superuser).viewSurgery('surgery3')).toBe(true)
      })

      it('should return true for user with membership in surgery', () => {
        expect(can(admin).viewSurgery('surgery1')).toBe(true)
        expect(can(admin).viewSurgery('surgery2')).toBe(true)
      })

      it('should return false for user without membership in surgery', () => {
        expect(can(admin).viewSurgery('surgery3')).toBe(false)
        expect(can(standardUser).viewSurgery('surgery2')).toBe(false)
      })
    })

    describe('isSuperuser', () => {
      it('should return true for superuser', () => {
        expect(can(superuser).isSuperuser()).toBe(true)
      })

      it('should return false for non-superuser', () => {
        expect(can(admin).isSuperuser()).toBe(false)
        expect(can(standardUser).isSuperuser()).toBe(false)
      })
    })

    describe('isAdminOfSurgery', () => {
      it('should return true for superuser', () => {
        expect(can(superuser).isAdminOfSurgery('surgery1')).toBe(true)
      })

      it('should return true for admin of the surgery', () => {
        expect(can(admin).isAdminOfSurgery('surgery1')).toBe(true)
      })

      it('should return false for standard user', () => {
        expect(can(standardUser).isAdminOfSurgery('surgery1')).toBe(false)
      })

      it('should return false for admin of different surgery', () => {
        expect(can(admin).isAdminOfSurgery('surgery2')).toBe(false)
      })
    })

    describe('getSurgeryRole', () => {
      it('should return SUPERUSER for superuser', () => {
        expect(can(superuser).getSurgeryRole('surgery1')).toBe('SUPERUSER')
      })

      it('should return role for user with membership', () => {
        expect(can(admin).getSurgeryRole('surgery1')).toBe('ADMIN')
        expect(can(admin).getSurgeryRole('surgery2')).toBe('STANDARD')
      })

      it('should return null for user without membership', () => {
        expect(can(admin).getSurgeryRole('surgery3')).toBe(null)
      })
    })

    describe('getSurgeryIds', () => {
      it('should return all surgery IDs for user', () => {
        expect(can(superuser).getSurgeryIds()).toEqual(['surgery1', 'surgery2'])
        expect(can(admin).getSurgeryIds()).toEqual(['surgery1', 'surgery2'])
        expect(can(standardUser).getSurgeryIds()).toEqual(['surgery1'])
      })
    })

    describe('getAdminSurgeryIds', () => {
      it('should return surgery IDs where user is admin', () => {
        expect(can(superuser).getAdminSurgeryIds()).toEqual(['surgery1'])
        expect(can(admin).getAdminSurgeryIds()).toEqual(['surgery1'])
        expect(can(standardUser).getAdminSurgeryIds()).toEqual([])
      })
    })
  })
})
