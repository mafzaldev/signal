import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const docs = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Position in the sidebar. */
    order: z.number(),
    /** Sidebar group heading. */
    section: z.enum(['Start here', 'Concepts', 'SDKs', 'Reference']),
  }),
});

export const collections = { docs };
