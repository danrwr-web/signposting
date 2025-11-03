import { SessionUser } from '@/lib/rbac'

export const isSuperuser = (user?: SessionUser | null) => user?.globalRole === 'SUPERUSER'

export const isPracticeAdmin = (user?: SessionUser | null) => user?.globalRole === 'PRACTICE_ADMIN'


