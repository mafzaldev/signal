'use client';

import Link from 'next/link';
import { type CSSProperties, useMemo, useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialog';
import { EnvironmentDot, environmentTone } from '@/components/environment';
import { SearchIcon } from '@/components/icons';
import { Input, Switch } from '@/components/ui';
import { summarizeConfig } from '@/lib/targeting';
import type { Environment, FlagSummary } from '@/lib/types';
import { updateFlagConfig } from '../actions';

/** One flag in one environment: a switch and what it serves. */
function Cell({
  projectKey,
  environment,
  flag,
}: {
  projectKey: string;
  environment: Environment;
  flag: FlagSummary;
}) {
  const config = flag.environments.find((c) => c.environmentKey === environment.key);
  const [enabled, setEnabled] = useOptimistic(config?.enabled ?? false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  if (!config) return <div />;

  async function toggle(next: boolean) {
    if (environmentTone(environment.key) === 'rose') {
      const ok = await confirm({
        title: `Turn ${next ? 'on' : 'off'} ${flag.name} in ${environment.name}?`,
        description: next
          ? 'Users start getting this flag’s targeted values right away.'
          : `Everyone in ${environment.name} gets the off value right away.`,
        confirmLabel: next ? 'Turn on' : 'Turn off',
        tone: next ? 'default' : 'danger',
      });
      if (!ok) return;
    }
    startTransition(async () => {
      setEnabled(next);
      const result = await updateFlagConfig(projectKey, flag.key, environment.key, {
        enabled: next,
      });
      if (result?.error) toast.error(result.error);
      else toast.success(`${flag.name} turned ${next ? 'on' : 'off'} in ${environment.name}`);
    });
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Switch
        checked={enabled}
        onChange={toggle}
        disabled={pending}
        label={`${flag.name} in ${environment.name}`}
      />
      <Link
        href={`/projects/${projectKey}/flags/${flag.key}?env=${environment.key}`}
        className="truncate font-mono text-xs text-muted hover:text-ink hover:underline"
      >
        {summarizeConfig({ ...config, enabled }, flag.variations)}
      </Link>
    </div>
  );
}

/** Every flag against every environment: rows are flags, and each cell is a live switch. */
export function Switchboard({
  projectKey,
  environments,
  flags,
}: {
  projectKey: string;
  environments: Environment[];
  flags: FlagSummary[];
}) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flags;
    return flags.filter((f) =>
      [f.name, f.key, f.description].some((text) => text.toLowerCase().includes(q)),
    );
  }, [flags, query]);

  const columns: CSSProperties = {
    gridTemplateColumns: `minmax(15rem, 1.4fr) repeat(${environments.length}, minmax(11rem, 1fr))`,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full sm:w-72">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search flags"
          aria-label="Search flags"
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-3xl">
          <div
            className="grid gap-6 border-b border-rule-strong px-3 pb-2 text-xs font-medium text-muted"
            style={columns}
          >
            <div className="flex items-end">Flag</div>
            {environments.map((env) => {
              const on = flags.filter(
                (f) => f.environments.find((c) => c.environmentKey === env.key)?.enabled,
              ).length;
              return (
                <div key={env.id} className="flex items-center gap-2">
                  <EnvironmentDot environmentKey={env.key} />
                  {env.name}
                  <span className="font-normal text-faint">
                    {on}/{flags.length} on
                  </span>
                </div>
              );
            })}
          </div>

          {visible.map((flag) => (
            <div
              key={flag.id}
              className="grid items-center gap-6 border-b border-rule px-3 py-3 transition-colors hover:bg-wash"
              style={columns}
            >
              <div className="min-w-0">
                <Link
                  href={`/projects/${projectKey}/flags/${flag.key}`}
                  className="block truncate font-medium text-ink hover:text-signal-ink"
                >
                  {flag.name}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-muted">
                  <span className="truncate">{flag.key}</span>
                  <span className="text-faint">{flag.kind}</span>
                </div>
              </div>
              {environments.map((env) => (
                <Cell key={env.id} projectKey={projectKey} environment={env} flag={flag} />
              ))}
            </div>
          ))}

          {visible.length === 0 && (
            <p className="border-b border-rule px-3 py-10 text-[13px] text-muted">
              No flags match “{query}”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
