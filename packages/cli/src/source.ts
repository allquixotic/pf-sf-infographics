import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  type ContentSource,
  GitHubContentSource,
  HttpContentSource,
  parseGitHubLocation,
} from '@pfsf/engine';
import { FsContentSource } from './fs-source';

export const REPO_ROOT = resolve(import.meta.dir, '../../..');

/**
 * Picks a content source from a CLI argument: a local folder, an http(s) URL, or a GitHub reference
 * (owner/repo[@ref][:dir] or a github.com URL). Without an argument, ./content or the repository's content folder.
 */
export function contentSourceFor(spec: string | undefined): ContentSource {
  if (!spec) {
    const local = resolve('content');
    return new FsContentSource(existsSync(join(local, 'manifest.json')) ? local : join(REPO_ROOT, 'content'));
  }
  if (/^https?:\/\//i.test(spec) && !/^https?:\/\/github\.com\//i.test(spec))
    return new HttpContentSource(spec);
  if (existsSync(spec)) return new FsContentSource(spec);
  return new GitHubContentSource(parseGitHubLocation(spec));
}
