import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getProject } from '@/lib/data';
import type { SdkKey } from '@/lib/types';
import { EnvironmentSdkKeys } from './sdk-keys';
import {
  CreateEnvironmentForm,
  DeleteProjectButton,
  EnvironmentList,
  RenameProjectForm,
} from './settings-forms';

export default async function ProjectSettingsPage({
  params,
}: PageProps<'/projects/[projectKey]/settings'>) {
  const { projectKey } = await params;
  const project = await getProject(projectKey);
  const keys = await Promise.all(
    project.environments.map((env) =>
      api<SdkKey[]>(`/projects/${projectKey}/environments/${env.key}/sdk-keys`),
    ),
  );

  return (
    <>
      <PageHeader
        title={`${project.name} settings`}
        actions={
          <Link href={`/projects/${projectKey}`} className="text-sm text-zinc-600 underline">
            Back to flags
          </Link>
        }
      />
      <div className="space-y-6">
        <Card>
          <h2 className="mb-3 font-medium">General</h2>
          <RenameProjectForm projectKey={projectKey} name={project.name} />
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">Environments</h2>
          <EnvironmentList projectKey={projectKey} environments={project.environments} />
          {/* Remounts (clearing the inputs) after an environment is added. */}
          <CreateEnvironmentForm key={project.environments.length} projectKey={projectKey} />
        </Card>
        <Card>
          <h2 className="font-medium">SDK keys</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Server-side SDKs use a key to read one environment&apos;s flags.
          </p>
          <div className="space-y-6">
            {project.environments.map((env, i) => (
              <EnvironmentSdkKeys
                key={env.id}
                projectKey={projectKey}
                environment={env}
                keys={keys[i]!}
              />
            ))}
          </div>
        </Card>
        <Card className="border-red-200">
          <h2 className="mb-1 font-medium">Delete project</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Deletes every flag and environment in this project. The audit log keeps its history.
          </p>
          <DeleteProjectButton projectKey={projectKey} name={project.name} />
        </Card>
      </div>
    </>
  );
}
