import Link from 'next/link';
import { Badge, Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getProject } from '@/lib/data';
import type { FlagSummary } from '@/lib/types';
import { CreateFlagForm } from './create-flag-form';
import { EnvironmentTabs, pickEnvironment } from './environment-tabs';
import { FlagToggle } from './flag-toggle';

export default async function ProjectPage({
  params,
  searchParams,
}: PageProps<'/projects/[projectKey]'>) {
  const { projectKey } = await params;
  const { env } = await searchParams;
  const [project, flags] = await Promise.all([
    getProject(projectKey),
    api<FlagSummary[]>(`/projects/${projectKey}/flags`),
  ]);
  const environment = pickEnvironment(project.environments, env);

  return (
    <>
      <PageHeader
        title={project.name}
        description={<span className="font-mono">{project.key}</span>}
        actions={
          <Link
            href={`/projects/${projectKey}/settings`}
            className="text-sm text-zinc-600 underline"
          >
            Settings
          </Link>
        }
      />

      {environment ? (
        <>
          <EnvironmentTabs
            environments={project.environments}
            active={environment.key}
            hrefFor={(key) => `/projects/${projectKey}?env=${key}`}
          />
          {flags.length > 0 ? (
            <div className="mb-8 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 font-medium">Flag</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">{environment.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {flags.map((flag) => {
                    const config = flag.environments.find(
                      (e) => e.environmentKey === environment.key,
                    );
                    return (
                      <tr key={flag.id}>
                        <td className="px-4 py-3">
                          <Link
                            href={`/projects/${projectKey}/flags/${flag.key}?env=${environment.key}`}
                            className="font-medium hover:underline"
                          >
                            {flag.name}
                          </Link>
                          <div className="font-mono text-xs text-zinc-500">{flag.key}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge>{flag.kind}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {config && (
                            <FlagToggle
                              projectKey={projectKey}
                              flagKey={flag.key}
                              environmentKey={environment.key}
                              environmentName={environment.name}
                              enabled={config.enabled}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-8 text-sm text-zinc-500">No flags yet.</p>
          )}
        </>
      ) : (
        <p className="mb-8 text-sm text-zinc-500">
          This project has no environments. Add one in settings.
        </p>
      )}

      <Card>
        <h2 className="mb-3 font-medium">New flag</h2>
        <CreateFlagForm projectKey={projectKey} />
      </Card>
    </>
  );
}
