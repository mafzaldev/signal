import Link from 'next/link';
import { CopyButton } from '@/components/copy-button';
import { EnvironmentDot, pickEnvironment } from '@/components/environment';
import { FlagIcon } from '@/components/icons';
import { cx, EmptyState, PageHeader, TabLinks } from '@/components/ui';
import { getFlag, getProject } from '@/lib/data';
import { FlagEditor } from './flag-editor';
import { FlagSettings } from './flag-settings';

export default async function FlagPage({
  params,
  searchParams,
}: PageProps<'/projects/[projectKey]/flags/[flagKey]'>) {
  const { projectKey, flagKey } = await params;
  const { env, tab } = await searchParams;
  const [project, flag] = await Promise.all([getProject(projectKey), getFlag(projectKey, flagKey)]);
  const environment = pickEnvironment(project.environments, env);
  const config = flag.environments.find((c) => c.environmentKey === environment?.key);
  const base = `/projects/${projectKey}/flags/${flagKey}`;
  const envQuery = environment ? `env=${environment.key}` : '';
  const activeTab = tab === 'settings' ? 'settings' : 'targeting';

  return (
    <>
      <PageHeader
        back={{ href: `/projects/${projectKey}`, label: `${project.name} flags` }}
        title={flag.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <code className="font-mono text-ink-2">{flag.key}</code>
            <CopyButton value={flag.key} label="Copy flag key" />
            <span className="font-mono text-faint">{flag.kind}</span>
            {flag.description && <span className="text-muted">· {flag.description}</span>}
          </span>
        }
      />

      <TabLinks
        active={activeTab}
        tabs={[
          { key: 'targeting', label: 'Targeting', href: `${base}?${envQuery}` },
          { key: 'settings', label: 'Settings', href: `${base}?tab=settings&${envQuery}` },
        ]}
      />

      {activeTab === 'settings' ? (
        <FlagSettings projectKey={projectKey} flag={flag} />
      ) : environment && config ? (
        <>
          {/* One tab per environment, each saying whether the flag is on there. */}
          <nav aria-label="Environment" className="mb-10 flex flex-wrap gap-1">
            {project.environments.map((env) => {
              const selected = env.key === environment.key;
              const on = flag.environments.find((c) => c.environmentKey === env.key)?.enabled;
              return (
                <Link
                  key={env.id}
                  href={`${base}?env=${env.key}`}
                  aria-current={selected ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors',
                    selected ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-wash',
                  )}
                >
                  <span className="text-xs font-medium flex items-center gap-2">
                    <EnvironmentDot environmentKey={env.key} />
                    {env.name}
                  </span>
                  <span
                    className={cx(
                      'text-xs',
                      selected ? 'text-paper/60' : on ? 'text-signal-ink' : 'text-faint',
                    )}
                  >
                    {on ? 'On' : 'Off'}
                  </span>
                </Link>
              );
            })}
          </nav>
          {/* Remounting on a new version resets the draft to what was saved. */}
          <FlagEditor
            key={`${environment.key}-${config.version}`}
            projectKey={projectKey}
            flag={flag}
            config={config}
            environment={environment}
          />
        </>
      ) : (
        <EmptyState
          icon={<FlagIcon />}
          title="No environments"
          description="Add an environment in this project’s settings to configure the flag."
        />
      )}
    </>
  );
}
