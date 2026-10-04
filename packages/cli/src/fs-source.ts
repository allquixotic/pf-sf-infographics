import { resolve, sep } from 'node:path';
import { ContentFetchError, type ContentSource } from '@pfsf/engine';

/** Reads a content tree from a local folder. */
export class FsContentSource implements ContentSource {
  readonly label: string;
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
    this.label = this.root;
  }

  private path(rel: string): string {
    const full = resolve(this.root, rel);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new ContentFetchError(rel, 'path escapes the content folder');
    }
    return full;
  }

  async readText(rel: string): Promise<string> {
    const f = Bun.file(this.path(rel));
    if (!(await f.exists())) throw new ContentFetchError(rel, `not found in ${this.root}`);
    return f.text();
  }

  async readBytes(rel: string): Promise<Uint8Array> {
    const f = Bun.file(this.path(rel));
    if (!(await f.exists())) throw new ContentFetchError(rel, `not found in ${this.root}`);
    return f.bytes();
  }
}
