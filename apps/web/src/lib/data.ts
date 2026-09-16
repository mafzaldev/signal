import 'server-only';
import { notFound } from 'next/navigation';
import { api, ApiError } from './api';
import type { FlagDetail, ProjectWithEnvironments } from './types';

async function orNotFound<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export const getProject = (projectKey: string) =>
  orNotFound(api<ProjectWithEnvironments>(`/projects/${projectKey}`));

export const getFlag = (projectKey: string, flagKey: string) =>
  orNotFound(api<FlagDetail>(`/projects/${projectKey}/flags/${flagKey}`));
