---
title: Team and keys
description: Organizations, roles and invitations, SDK keys, and the audit log.
order: 8
section: Reference
---

## Organizations

An **organization** is your team's workspace. It owns projects, members and the audit log, and nothing is shared between organizations. If you belong to more than one, switch between them from the menu in the dashboard's top bar.

## Roles

| Role       | Can                                                               |
| ---------- | ----------------------------------------------------------------- |
| **Owner**  | Everything, including deleting the organization                   |
| **Admin**  | Everything except deleting the organization or changing its owner |
| **Member** | See everything; create, edit and delete flags                     |
| **Viewer** | See everything, change nothing                                    |

Managing projects, environments, SDK keys and members takes an owner or admin.

## Inviting people

Owners and admins invite people from the **Members** page by email, choosing their role. The invitee gets a link (or you copy it from the page if email isn't set up), signs in or signs up with that address, and accepts. Invitations expire after 48 hours.

## SDK keys

Each key belongs to one environment. Create and revoke them in project settings.

| Kind       | Starts with | Used by     | Can read                                               |
| ---------- | ----------- | ----------- | ------------------------------------------------------ |
| **Server** | `sdk-`      | Server SDK  | Every flag's rules. Keep it secret                     |
| **Client** | `client-`   | Browser SDK | Only evaluated values of flags with client-side access |

- A key is shown once, when it's created. Signal stores only a fingerprint of it.
- Each kind is refused on the other's endpoints, so a client key can never read rules.
- Revoking a key disconnects every app using it straight away.

## Audit log

Every change to projects, environments, flags and keys is recorded with who made it, when, and the before and after. The change and its entry are saved together, so nothing goes unrecorded. Filter the log by project, kind of change or person, and open an entry to compare the before and after.
