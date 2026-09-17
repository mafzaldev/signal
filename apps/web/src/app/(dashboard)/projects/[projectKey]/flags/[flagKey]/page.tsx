import Link from 'next/link';
import { Badge, Card, PageHeader } from '@/components/ui';
import { getFlag, getProject } from '@/lib/data';
import { EnvironmentTabs, pickEnvironment } from '../../environment-tabs';
import { FlagDetailsForm } from './flag-details-form';
import { FlagEditor } from './flag-editor';

export default async function FlagPage({
  params,
  searchParams,
}: PageProps<'/projects/[projectKey]/flags/[flagKey]'>) {
  const { projectKey, flagKey } = await params;
  const { env } = await searchParams;
  const [project, flag] = await Promise.all([getProject(projectKey), getFlag(projectKey, flagKey)]);
  const environment = pickEnvironment(project.environments, env);
  const config = flag.environments.find((c) => c.environmentKey === environment?.key);

  return (
    <>
      <PageHeader
        title={flag.name}
        description={
          <span className="flex items-center gap-2">
            <span className="font-mono">{flag.key}</span>
            <Badge>{flag.kind}</Badge>
            {flag.description}
          </span>
        }
        actions={
          <Link
            href={`/projects/${projectKey}${environment ? `?env=${environment.key}` : ''}`}
            className="text-sm text-zinc-600 underline"
          >
            All flags
          </Link>
        }
      />
      {environment && config ? (
        <>
          <EnvironmentTabs
            environments={project.environments}
            active={environment.key}
            hrefFor={(key) => `/projects/${projectKey}/flags/${flagKey}?env=${key}`}
          />
          {/* Remounting on a new version resets the draft to what was saved. */}
          <FlagEditor
            key={`${environment.key}-${config.version}`}
            projectKey={projectKey}
            flag={flag}
            config={config}
            environmentName={environment.name}
          />
        </>
      ) : (
        <p className="text-sm text-zinc-500">This project has no environments.</p>
      )}
      <Card className="mt-6">
        <h2 className="mb-3 font-medium">Flag details</h2>
        <FlagDetailsForm projectKey={projectKey} flag={flag} />
      </Card>
    </>
  );
}
