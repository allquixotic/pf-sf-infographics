# Release invariants

## §V

- V1: Bundled content paths must avoid Windows device names, including names with extensions. Verify with `packages/cli/test/content.test.ts` and Windows CI checkout.

## §B

| id | date | cause | fix |
| --- | --- | --- | --- |
| B1 | 2026-10-04 | Constitution icon named `con.svg`; Windows checkout rejected reserved device name. | V1; rename to `constitution.svg`, update game references and manifest. |
