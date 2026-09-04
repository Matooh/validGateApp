import { AppChrome } from '@/components/app-chrome';
import { hasPermission } from '@/lib/permissions';
import type { AppRole } from '@/lib/types';

type AppNavProps = {
  role?: AppRole | null;
  displayName?: string | null;
};

export function AppNav({ role, displayName }: AppNavProps) {
  const profileLabel = displayName?.trim() || 'No Profile';
  const roleLabel = role === 'PENDIENTE' ? 'Sin rol asignado' : role ?? 'SIN ROL';
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'home' as const },
    ...(hasPermission(role ?? null, 'view_links') ? [{ href: '/links', label: 'Vínculos', icon: 'student' as const }] : []),
    ...(hasPermission(role ?? null, 'link_student') ? [{ href: '/students/link', label: 'Vincular estudiante', icon: 'student' as const }] : []),
    ...(hasPermission(role ?? null, 'manage_students') ? [{ href: '/admin/students', label: 'Estudiantes', icon: 'student' as const }] : []),
    ...(hasPermission(role ?? null, 'manage_roles') ? [{ href: '/admin/users', label: 'Usuarios', icon: 'student' as const }] : []),
    ...(hasPermission(role ?? null, 'view_guard_module') ? [{ href: '/guard', label: 'Portería', icon: 'guard' as const }] : []),
    ...(hasPermission(role ?? null, 'view_authentications') ? [{ href: '/authentications', label: 'Autenticaciones', icon: 'auth' as const }] : []),
    { href: '/settings', label: 'Config', icon: 'settings' as const },
  ];

  return <AppChrome displayName={profileLabel} roleLabel={roleLabel} navItems={navItems} />;
}
