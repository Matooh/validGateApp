import type { AppRole } from '@/lib/types';

export type AppPermission =
  | 'view_dashboard'
  | 'view_guard_module'
  | 'register_access_event'
  | 'view_recent_events'
  | 'view_students_linked'
  | 'view_links'
  | 'authorize_retirador'
  | 'link_student'
  | 'unlink_student'
  | 'view_student_detail'
  | 'view_authentications'
  | 'update_student'
  | 'view_courses'
  | 'view_attendance'
  | 'manage_users'
  | 'manage_students'
  | 'manage_roles'
  | 'manage_feature_flags';

const ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  PENDIENTE: [],
  ADMIN: [
    'view_dashboard',
    'view_guard_module',
    'register_access_event',
    'view_recent_events',
    'view_students_linked',
    'view_links',
    'authorize_retirador',
    'unlink_student',
    'view_student_detail',
    'view_authentications',
    'update_student',
    'view_courses',
    'view_attendance',
    'manage_users',
    'manage_students',
    'manage_roles',
    'manage_feature_flags',
  ],
  PORTERIA: [
    'view_dashboard',
    'view_guard_module',
    'register_access_event',
    'view_recent_events',
    'view_student_detail',
    'view_courses',
  ],
  DOCENTE: [
    'view_dashboard',
    'view_recent_events',
    'view_student_detail',
    'view_courses',
    'view_attendance',
  ],
  APODERADO: [
    'view_dashboard',
    'view_students_linked',
    'view_links',
    'authorize_retirador',
    'link_student',
    'unlink_student',
    'view_student_detail',
    'view_authentications',
    'view_recent_events',
  ],
  RETIRADOR_AUTORIZADO: [
    'view_dashboard',
    'view_students_linked',
    'view_links',
    'view_recent_events',
  ],
  ESTUDIANTE: [
    'view_dashboard',
    'view_links',
    'view_student_detail',
    'view_authentications',
    'view_attendance',
  ],
};

export function hasPermission(
  role: AppRole | null | undefined,
  permission: AppPermission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(
  role: AppRole | null | undefined,
  permissions: AppPermission[],
): boolean {
  if (!role) return false;
  return permissions.some((permission) => hasPermission(role, permission));
}
