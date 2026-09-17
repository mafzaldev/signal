'use client';

import { useOptimistic, useTransition } from 'react';
import { Switch } from '@/components/ui';
import { updateFlagConfig } from '../actions';

export function FlagToggle({
  projectKey,
  flagKey,
  environmentKey,
  environmentName,
  enabled,
}: {
  projectKey: string;
  flagKey: string;
  environmentKey: string;
  environmentName: string;
  enabled: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    if (
      environmentKey === 'production' &&
      !window.confirm(`Turn ${next ? 'on' : 'off'} "${flagKey}" in ${environmentName}?`)
    ) {
      return;
    }
    startTransition(async () => {
      setOptimistic(next);
      const result = await updateFlagConfig(projectKey, flagKey, environmentKey, { enabled: next });
      if (result?.error) window.alert(result.error);
    });
  }

  return (
    <Switch
      checked={optimistic}
      onChange={toggle}
      disabled={pending}
      label={`${flagKey} in ${environmentName}`}
    />
  );
}
