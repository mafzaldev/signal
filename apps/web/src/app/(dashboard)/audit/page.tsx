import Link from 'next/link';
import { Badge, Button, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { changedFields } from '@/lib/targeting';
import type { AuditEntry, AuditPage, Member, Project } from '@/lib/types';

const ENTITY_TYPES = ['project', 'environment', 'flag', 'flag_config', 'sdk_key'];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Snapshot({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-xs font-medium text-zinc-500 uppercase">{label}</div>
      <pre className="max-h-80 overflow-auto rounded bg-zinc-50 p-2 text-xs">
        {value === null || value === undefined ? '—' : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function EntryRow({ entry, actor }: { entry: AuditEntry; actor: string }) {
  const fields = entry.before && entry.after ? changedFields(entry.before, entry.after) : [];
  return (
    <li className="px-4 py-3">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Badge>{entry.action}</Badge>
          <span className="font-medium">{actor}</span>
          {fields.length > 0 && <span className="text-zinc-500">changed {fields.join(', ')}</span>}
          <time className="ml-auto text-xs text-zinc-500" dateTime={entry.createdAt}>
            {new Date(entry.createdAt).toLocaleString()}
          </time>
        </summary>
        <div className="mt-3 flex gap-3">
          <Snapshot label="Before" value={entry.before} />
          <Snapshot label="After" value={entry.after} />
        </div>
      </details>
    </li>
  );
}

export default async function AuditPage({ searchParams }: PageProps<'/audit'>) {
  const params = await searchParams;
  const project = first(params.project);
  const type = first(params.type);
  const cursor = first(params.cursor);

  const query = new URLSearchParams({ limit: '50' });
  if (project) query.set('projectKey', project);
  if (type) query.set('entityType', type);
  if (cursor) query.set('cursor', cursor);

  const [page, projects, { members }] = await Promise.all([
    api<AuditPage>(`/audit-logs?${query}`),
    api<Project[]>('/projects'),
    api<{ members: Member[] }>('/api/auth/organization/list-members'),
  ]);
  const actorName = (id: string | null) => {
    const member = members.find((m) => m.user.id === id);
    return member ? member.user.name : 'Former member';
  };

  const nextPage = new URLSearchParams();
  if (project) nextPage.set('project', project);
  if (type) nextPage.set('type', type);
  if (page.nextCursor) nextPage.set('cursor', page.nextCursor);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change to projects and flags, newest first."
      />
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <Select name="project" defaultValue={project ?? ''} className="w-48" aria-label="Project">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.key}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select name="type" defaultValue={type ?? ''} className="w-48" aria-label="Change type">
          <option value="">All changes</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {page.items.length > 0 ? (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {page.items.map((entry) => (
            <EntryRow key={entry.id} entry={entry} actor={actorName(entry.actorId)} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No changes recorded.</p>
      )}

      <div className="mt-4 flex gap-4 text-sm">
        {cursor && (
          <Link href="/audit" className="underline">
            Newest
          </Link>
        )}
        {page.nextCursor && (
          <Link href={`/audit?${nextPage}`} className="underline">
            Older entries
          </Link>
        )}
      </div>
    </>
  );
}
