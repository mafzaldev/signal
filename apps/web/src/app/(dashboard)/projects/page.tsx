import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';
import { CreateProjectForm } from './create-project-form';

export default async function ProjectsPage() {
  const projects = await api<Project[]>('/projects');

  return (
    <>
      <PageHeader title="Projects" description="Each project has its own flags and environments." />
      {projects.length > 0 ? (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.key}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
              >
                <div className="font-medium">{project.name}</div>
                <div className="font-mono text-xs text-zinc-500">{project.key}</div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-8 text-sm text-zinc-500">No projects yet.</p>
      )}
      <Card>
        <h2 className="mb-3 font-medium">New project</h2>
        <CreateProjectForm />
      </Card>
    </>
  );
}
