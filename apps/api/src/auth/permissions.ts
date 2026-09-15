import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access';

const statement = {
  ...defaultStatements,
  project: ['create', 'update', 'delete'],
  flag: ['create', 'update', 'delete'],
} as const;

export const ac = createAccessControl(statement);

const manageEverything = {
  project: ['create', 'update', 'delete'],
  flag: ['create', 'update', 'delete'],
} as const;

export const roles = {
  owner: ac.newRole({ ...ownerAc.statements, ...manageEverything }),
  admin: ac.newRole({ ...adminAc.statements, ...manageEverything }),
  /** Can work on flags but not change projects or the organization. */
  member: ac.newRole({ ...memberAc.statements, flag: ['create', 'update', 'delete'] }),
  /** Read-only. */
  viewer: ac.newRole({ ...memberAc.statements }),
};
