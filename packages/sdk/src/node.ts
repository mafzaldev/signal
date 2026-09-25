import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FlagStorage } from './storage.js';

/**
 * Keeps the last known flags in a JSON file. Writes go to a temporary file
 * first and are renamed into place, so a crash never leaves a half-written cache.
 */
export function fileStorage(path: string): FlagStorage {
  return {
    async get() {
      try {
        return await readFile(path, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    async set(value) {
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${process.pid}.tmp`;
      await writeFile(temporary, value, 'utf8');
      await rename(temporary, path);
    },
  };
}

export type { FlagStorage } from './storage.js';
