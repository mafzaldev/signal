import { FlagIcon } from '@/components/icons';
import { EmptyState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getProject } from '@/lib/data';
import type { FlagSummary } from '@/lib/types';
import { CreateFlagButton } from './create-flag-form';
import { Switchboard } from './flag-list';

export default async function ProjectFlagsPage({ params }: PageProps<'/projects/[projectKey]'>) {
  const { projectKey } = await params;
  const [project, flags] = await Promise.all([
    getProject(projectKey),
    api<FlagSummary[]>(`/projects/${projectKey}/flags`),
  ]);

  return (
    <>
      <PageHeader
        title={project.name}
        description="Flip a switch to turn a flag on or off in that environment. Open a flag to change who gets what."
        actions={flags.length > 0 && <CreateFlagButton projectKey={projectKey} />}
      />

      {project.environments.length === 0 ? (
        <EmptyState
          icon={<FlagIcon />}
          title="No environments"
          description="Flags are configured per environment. Add one in this project's settings."
        />
      ) : flags.length === 0 ? (
        <EmptyState
          icon={<FlagIcon />}
          title="Create your first flag"
          description="A flag starts switched off in every environment, so creating one never changes what your users see."
          action={<CreateFlagButton projectKey={projectKey} />}
        />
      ) : (
        <Switchboard projectKey={projectKey} environments={project.environments} flags={flags} />
      )}
    </>
  );
}
