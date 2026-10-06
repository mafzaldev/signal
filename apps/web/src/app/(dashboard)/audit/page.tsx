import Link from 'next/link';
import { EnvironmentDot } from '@/components/environment';
import { HistoryIcon } from '@/components/icons';
import { buttonClass, EmptyState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { describeAuditEntry, fieldLabel } from '@/lib/audit';
import { changedFields } from '@/lib/targeting';
import type { AuditEntry, AuditPage as AuditPageData, Member, Project } from '@/lib/types';
import { AuditFilters } from './audit-filters';

const HIDDEN_FIELDS = new Set([
  'id',
  'organizationId',
  'projectId',
  'environmentId',
  'flagId',
  'createdAt',
  'updatedAt',
  'version',
  'salt',
  'flagKey',
  'environmentKey',
  'environments',
]);

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function Value({ value }: { value: unknown }) {
  if (value === undefined || value === null) return <span className="text-faint">—</span>;
  if (typeof value === 'object') {
    return (
      <pre className="max-h-48 overflow-auto rounded-md bg-surface p-2 font-mono text-xs whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <code className="font-mono text-xs break-all">{JSON.stringify(value)}</code>;
}

/** What changed: before and after for updates, the stored values for creates and deletes. */
function Changes({ entry }: { entry: AuditEntry }) {
  const before = (entry.before ?? {}) as Record<string, unknown>;
  const after = (entry.after ?? {}) as Record<string, unknown>;
  const isUpdate = entry.before != null && entry.after != null;
  const fields = isUpdate
    ? changedFields(entry.before, entry.after)
    : Object.keys(entry.after ?? entry.before ?? {}).filter((f) => !HIDDEN_FIELDS.has(f));

  if (fields.length === 0) return <p className="text-[13px] text-muted">No visible changes.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead className="text-xs font-medium border-b border-rule-strong text-muted">
          <tr>
            <th className="w-36 py-1.5 pr-4 font-medium">Field</th>
            {isUpdate ? (
              <>
                <th className="py-1.5 pr-4 font-medium">Before</th>
                <th className="py-1.5 font-medium">After</th>
              </>
            ) : (
              <th className="py-1.5 font-medium">Value</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule align-top">
          {fields.map((field) => (
            <tr key={field}>
              <td className="py-2 pr-4 font-medium text-ink-2 capitalize">{fieldLabel(field)}</td>
              {isUpdate ? (
                <>
                  <td className="py-2 pr-4">
                    <Value value={before[field]} />
                  </td>
                  <td className="py-2">
                    <Value value={after[field]} />
                  </td>
                </>
              ) : (
                <td className="py-2">
                  <Value value={after[field] ?? before[field]} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    api<AuditPageData>(`/audit-logs?${query}`),
    api<Project[]>('/projects'),
    api<{ members: Member[] }>('/api/auth/organization/list-members'),
  ]);
  const actorName = (id: string | null) =>
    members.find((m) => m.user.id === id)?.user.name ?? 'A former member';
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name;

  const days = new Map<string, AuditEntry[]>();
  for (const entry of page.items) {
    const label = dayLabel(new Date(entry.createdAt));
    days.set(label, [...(days.get(label) ?? []), entry]);
  }

  const olderParams = new URLSearchParams();
  if (project) olderParams.set('project', project);
  if (type) olderParams.set('type', type);
  if (page.nextCursor) olderParams.set('cursor', page.nextCursor);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change to projects, flags and SDK keys in this organization."
        actions={<AuditFilters projects={projects} project={project} type={type} />}
      />

      {page.items.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon />}
          title="No changes yet"
          description={
            project || type
              ? 'Nothing matches these filters.'
              : 'Changes to projects, flags and SDK keys will appear here.'
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {[...days].map(([day, entries]) => (
            <section key={day}>
              <h2 className="border-b border-rule-strong px-3 pb-2 font-semibold">{day}</h2>
              <ul>
                {entries.map((entry) => {
                  const actor = actorName(entry.actorId);
                  const { text, environmentKey } = describeAuditEntry(entry);
                  const projectLabel = projectName(entry.projectId);
                  return (
                    <li key={entry.id} className="border-b border-rule">
                      <details className="group">
                        <summary className="flex list-none items-start gap-4 px-3 py-3 hover:bg-wash">
                          <time
                            className="w-12 shrink-0 pt-px font-mono text-xs text-muted tabular-nums"
                            dateTime={entry.createdAt}
                          >
                            {new Date(entry.createdAt).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })}
                          </time>
                          <span className="min-w-0 flex-1">
                            <span className="block">
                              <span className="font-semibold">{actor}</span> {text}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                              {environmentKey && (
                                <span className="inline-flex items-center gap-1.5">
                                  <EnvironmentDot environmentKey={environmentKey} />
                                  {environmentKey}
                                </span>
                              )}
                              {projectLabel && <span>{projectLabel}</span>}
                            </span>
                          </span>
                          <span className="font-mono text-xs text-faint group-open:rotate-90">
                            ›
                          </span>
                        </summary>
                        <div className="border-t border-dashed border-rule-strong py-4 pr-3 pl-19">
                          <Changes entry={entry} />
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {(cursor || page.nextCursor) && (
            <div className="flex gap-2">
              {cursor && (
                <Link href="/audit" className={buttonClass('secondary')}>
                  Newest
                </Link>
              )}
              {page.nextCursor && (
                <Link href={`/audit?${olderParams}`} className={buttonClass('secondary')}>
                  Older changes
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
