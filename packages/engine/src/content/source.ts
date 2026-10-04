/**
 * Where content comes from. The engine never touches the file system or network directly; callers hand it a
 * ContentSource. Paths are always POSIX-style and relative to the content root (the folder holding manifest.json).
 */
export interface ContentSource {
  /** Human-readable description shown in messages, e.g. a URL or folder. */
  readonly label: string;
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
}

/** The subset of `fetch` the engine needs (lets callers pass wrappers without Bun/DOM extras such as preconnect). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ContentFetchError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'ContentFetchError';
  }
}

/** Normalises `rel` against the directory of `from` and refuses paths that escape the content root. */
export function resolvePath(from: string, rel: string): string {
  const base = from.includes('/') ? from.slice(0, from.lastIndexOf('/')).split('/') : [];
  const out = [...base];
  for (const part of rel.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length === 0) throw new ContentFetchError(rel, `path escapes the content root (from ${from})`);
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join('/');
}

/** Reads content over HTTP(S) relative to a base URL. Works in browsers, Bun and Node. */
export class HttpContentSource implements ContentSource {
  readonly label: string;
  private readonly base: string;

  constructor(
    baseUrl: string,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly init: RequestInit = {},
  ) {
    this.base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.label = this.base;
  }

  private async get(path: string): Promise<Response> {
    const url = new URL(path, this.base).toString();
    // Called unbound: passing the global fetch and invoking it as a method throws "Illegal invocation".
    const doFetch = this.fetchImpl;
    let res: Response;
    try {
      res = await doFetch(url, this.init);
    } catch (err) {
      throw new ContentFetchError(path, `network error fetching ${url}: ${(err as Error).message}`);
    }
    if (!res.ok) throw new ContentFetchError(path, `HTTP ${res.status} fetching ${url}`);
    return res;
  }

  async readText(path: string): Promise<string> {
    return (await this.get(path)).text();
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return new Uint8Array(await (await this.get(path)).arrayBuffer());
  }
}

export interface GitHubLocation {
  owner: string;
  repo: string;
  /** Branch, tag or commit SHA. */
  ref: string;
  /** Folder inside the repository that holds manifest.json. */
  dir?: string;
}

/** Base URL for raw files of a GitHub repository (raw.githubusercontent.com sends CORS headers). */
export function githubRawBaseUrl({ owner, repo, ref, dir = 'content' }: GitHubLocation): string {
  const clean = dir.replace(/^\/+|\/+$/g, '');
  const enc = (s: string) => s.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${enc(owner)}/${enc(repo)}/${enc(ref)}/${clean ? `${enc(clean)}/` : ''}`;
}

/**
 * Parses "owner/repo", "owner/repo@ref", "owner/repo@ref:dir" or a github.com URL
 * (https://github.com/owner/repo/tree/ref/dir).
 */
export function parseGitHubLocation(
  input: string,
  defaults: { ref?: string; dir?: string } = {},
): GitHubLocation {
  const trimmed = input.trim();
  const url = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:\/tree\/([^/#?]+)(?:\/([^#?]*))?)?/i.exec(
    trimmed,
  );
  if (url) {
    return {
      owner: url[1]!,
      repo: url[2]!.replace(/\.git$/, ''),
      ref: url[3] ?? defaults.ref ?? 'main',
      dir: url[4] ?? defaults.dir ?? 'content',
    };
  }
  const short = /^([\w.-]+)\/([\w.-]+)(?:@([^:]+))?(?::(.*))?$/.exec(trimmed);
  if (!short)
    throw new Error(`Not a GitHub repository reference: "${input}" (expected owner/repo[@ref][:dir])`);
  return {
    owner: short[1]!,
    repo: short[2]!,
    ref: short[3] ?? defaults.ref ?? 'main',
    dir: short[4] ?? defaults.dir ?? 'content',
  };
}

export class GitHubContentSource extends HttpContentSource {
  constructor(
    readonly location: GitHubLocation,
    fetchImpl?: FetchLike,
  ) {
    super(githubRawBaseUrl(location), fetchImpl, { cache: 'no-cache' });
  }
}

/** In-memory content, handy for tests and for content uploaded by a user. */
export class MemoryContentSource implements ContentSource {
  constructor(
    private readonly files: Map<string, Uint8Array | string>,
    readonly label = 'memory',
  ) {}

  private get(path: string): Uint8Array | string {
    const f = this.files.get(path);
    if (f === undefined) throw new ContentFetchError(path, 'not found');
    return f;
  }

  async readText(path: string): Promise<string> {
    const f = this.get(path);
    return typeof f === 'string' ? f : new TextDecoder().decode(f);
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const f = this.get(path);
    return typeof f === 'string' ? new TextEncoder().encode(f) : f;
  }
}
