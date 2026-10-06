'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { Select } from '@/components/select';
import type { Project } from '@/lib/types';

const CHANGE_TYPES = [
  { value: 'flag_config', label: 'Targeting changes' },
  { value: 'flag', label: 'Flags' },
  { value: 'project', label: 'Projects' },
  { value: 'environment', label: 'Environments' },
  { value: 'sdk_key', label: 'SDK keys' },
];

/** Filters apply as soon as they change; they live in the URL. */
export function AuditFilters({
  projects,
  project,
  type,
}: {
  projects: Project[];
  project?: string;
  type?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  // Shows the picked value straight away; otherwise the select snaps back to the URL's
  // value until the filtered page arrives.
  const [filters, setFilters] = useOptimistic({ project, type });

  function apply(next: { project?: string; type?: string }) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.project) params.set('project', merged.project);
    if (merged.type) params.set('type', merged.type);
    startTransition(() => {
      setFilters(merged);
      router.push(params.size ? `${pathname}?${params}` : pathname);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        label="Project"
        className="w-48"
        value={filters.project ?? ''}
        onChange={(next) => apply({ project: next || undefined })}
        options={[
          { value: '', label: 'All projects' },
          ...projects.map((p) => ({ value: p.key, label: p.name })),
        ]}
      />
      <Select
        label="Change type"
        className="w-48"
        value={filters.type ?? ''}
        onChange={(next) => apply({ type: next || undefined })}
        options={[{ value: '', label: 'All changes' }, ...CHANGE_TYPES]}
      />
    </div>
  );
}
