import type { Role } from './types';

/** What each role can do, in the words the dashboard shows. Matches the API's permissions. */
export const ROLES: { role: Role; label: string; description: string }[] = [
  { role: 'owner', label: 'Owner', description: 'Everything, including deleting the organization' },
  { role: 'admin', label: 'Admin', description: 'Projects, environments, SDK keys and members' },
  { role: 'member', label: 'Member', description: 'Creates and changes flags' },
  { role: 'viewer', label: 'Viewer', description: 'Read-only' },
];

export const roleLabel = (role: Role) => ROLES.find((r) => r.role === role)?.label ?? role;

/** Owners and admins invite people and change roles; the API enforces the same rule. */
export const canManageMembers = (role: Role) => role === 'owner' || role === 'admin';
