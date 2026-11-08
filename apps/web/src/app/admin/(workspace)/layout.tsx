import type { ReactNode } from 'react';
import { AdminShell } from '../../../components/admin-shell';
export default function AdminWorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
