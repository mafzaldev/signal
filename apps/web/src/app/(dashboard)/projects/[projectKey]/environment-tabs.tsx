import Link from 'next/link';
import type { Environment } from '@/lib/types';

export function EnvironmentTabs({
  environments,
  active,
  hrefFor,
}: {
  environments: Environment[];
  active: string;
  hrefFor: (environmentKey: string) => string;
}) {
  return (
    <div className="mb-4 flex gap-1 border-b border-zinc-200">
      {environments.map((env) => (
        <Link
          key={env.id}
          href={hrefFor(env.key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${
            env.key === active
              ? 'border-zinc-900 font-medium text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}
        >
          {env.name}
        </Link>
      ))}
    </div>
  );
}

/** The `?env=` environment if it exists, otherwise the first one. */
export function pickEnvironment(environments: Environment[], requested: unknown) {
  return environments.find((e) => e.key === requested) ?? environments[0];
}
