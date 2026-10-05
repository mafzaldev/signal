import Link from 'next/link';
import { ArrowRightIcon, FolderIcon } from '@/components/icons';
import { EmptyState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';
import { CreateProjectButton } from '../create-project-button';

export default async function ProjectsPage() {
  const projects = await api<Project[]>('/projects');

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project has its own flags, environments and SDK keys."
        actions={projects.length > 0 && <CreateProjectButton />}
      />
      {projects.length > 0 ? (
        <div>
          <div className="text-xs font-medium grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1rem] gap-6 border-b border-rule-strong px-3 pb-2 text-muted">
            <span>Project</span>
            <span>Key</span>
          </div>
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.key}`}
                  className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1rem] items-center gap-6 border-b border-rule px-3 py-3 transition-colors hover:bg-wash"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <FolderIcon className="size-4 shrink-0 text-muted" />
                    <span className="truncate font-medium">{project.name}</span>
                  </span>
                  <span className="truncate font-mono text-xs text-muted">{project.key}</span>
                  <ArrowRightIcon className="size-4 text-muted group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon={<FolderIcon />}
          title="Create your first project"
          description="A project usually maps to one app or service. It comes with Development, Staging and Production environments."
          action={<CreateProjectButton />}
        />
      )}
    </>
  );
}
