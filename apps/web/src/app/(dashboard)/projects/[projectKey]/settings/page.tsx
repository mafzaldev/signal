import { PageHeader, SettingsSection } from '@/components/ui';
import { api } from '@/lib/api';
import { getProject } from '@/lib/data';
import type { SdkKey } from '@/lib/types';
import { SdkKeys } from './sdk-keys';
import { DeleteProjectButton, EnvironmentList, RenameProjectForm } from './settings-forms';

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
        title="Settings"
        description={`Name, environments and SDK keys for ${project.name}.`}
      />
      <div>
        <SettingsSection title="General" description="The project’s name and key.">
          <RenameProjectForm projectKey={projectKey} name={project.name} />
        </SettingsSection>
        <SettingsSection
          title="Environments"
          description="Each environment has its own settings for every flag, such as Development, Staging and Production."
        >
          <EnvironmentList projectKey={projectKey} environments={project.environments} />
        </SettingsSection>
        <SettingsSection
          title="SDK keys"
          description="Apps use a key to read one environment’s flags. Only the first characters are shown after creation."
        >
          <SdkKeys projectKey={projectKey} environments={project.environments} keys={keys} />
        </SettingsSection>
        <SettingsSection
          title="Delete project"
          description="Permanently removes the project, its flags, environments and SDK keys."
        >
          <DeleteProjectButton projectKey={projectKey} name={project.name} />
        </SettingsSection>
      </div>
    </>
  );
}
