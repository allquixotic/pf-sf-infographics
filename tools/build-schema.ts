/**
 * Writes JSON Schema files for the content format into content/schema/, generated from the zod schemas in the
 * engine, so editors can autocomplete and validate content files. Run with `bun run content:schema`.
 */
import { join } from 'node:path';
import { classSchema, gameSchema, manifestSchema, themeSchema } from '@pfsf/engine';
import { z } from 'zod';

const out = join(import.meta.dir, '..', 'content', 'schema');
const schemas = { manifest: manifestSchema, game: gameSchema, class: classSchema, theme: themeSchema };

for (const [name, schema] of Object.entries(schemas)) {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  const path = join(out, `${name}.schema.json`);
  await Bun.write(path, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`wrote ${path}`);
}
