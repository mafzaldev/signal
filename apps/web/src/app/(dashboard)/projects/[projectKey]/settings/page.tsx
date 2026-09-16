import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { getProject } from '@/lib/data';
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
