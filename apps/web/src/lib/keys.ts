/** Suggests a key (lowercase, dashes) from a display name. */
export function toKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
