/**
 * Local GUI launcher (run by start.sh / start.bat, or `bun start`): installs dependencies if needed, offers to
 * download the Paizo Community Use Package portraits, starts the web UI's development server and opens it in the
 * default browser. Content is read live from ./content, so edits on a fork show up without committing anything.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

const root = join(import.meta.dir, '..');
const bun = process.execPath;

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'no-open': { type: 'boolean' },
    port: { type: 'string' },
    'fetch-art': { type: 'boolean' },
    'skip-art': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (args.help) {
  console.log(`Usage: start.sh [--no-open] [--port N] [--fetch-art | --skip-art]

  --no-open     do not open a browser
  --port N      port for the local server (default 5173, or the next free one)
  --fetch-art   download the Paizo Community Use Package portraits without asking
  --skip-art    do not offer to download them`);
  process.exit(0);
}

async function run(cmd: string[], cwd = root): Promise<void> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'inherit', stderr: 'inherit', stdin: 'inherit' });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`${cmd.join(' ')} exited with ${code}`);
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string[];
  if (platform === 'darwin') cmd = ['open', url];
  else if (platform === 'win32') cmd = ['cmd', '/c', 'start', '', url];
  else if (process.env.WSL_DISTRO_NAME)
    cmd = Bun.which('wslview') ? ['wslview', url] : ['cmd.exe', '/c', 'start', '', url];
  else cmd = ['xdg-open', url];
  try {
    Bun.spawn(cmd, { stdout: 'ignore', stderr: 'ignore' });
  } catch {
    console.log(`Open ${url} in your browser.`);
  }
}

async function maybeFetchArt(): Promise<void> {
  const dir = join(root, 'local-assets', 'paizo');
  const hasZips = existsSync(dir) && readdirSync(dir).some((f) => f.toLowerCase().endsWith('.zip'));
  if (hasZips || args['skip-art']) return;
  let yes = args['fetch-art'] ?? false;
  if (!yes && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      'Download the official iconic portraits from Paizo’s Community Use Package (about 76 MB) into local-assets/? [y/N] ',
    );
    rl.close();
    yes = /^y(es)?$/i.test(answer.trim());
  }
  if (yes) await run([bun, join(root, 'packages/cli/src/main.ts'), 'fetch-art']);
  else
    console.log(
      'Skipping official art. You can fetch it later with ./pfsf.sh fetch-art (pfsf.bat on Windows).',
    );
}

if (!existsSync(join(root, 'node_modules'))) {
  console.log('Installing dependencies…');
  await run([bun, 'install', '--frozen-lockfile']);
}

await maybeFetchArt();

const vite = Bun.spawn([bun, 'run', 'dev', ...(args.port ? ['--', '--port', args.port] : [])], {
  cwd: join(root, 'packages/web'),
  stdout: 'pipe',
  stderr: 'inherit',
  stdin: 'ignore',
  env: { ...process.env, FORCE_COLOR: '1' },
});

const stop = () => {
  vite.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

let opened = false;
const decoder = new TextDecoder();
for await (const chunk of vite.stdout) {
  const text = decoder.decode(chunk);
  process.stdout.write(text);
  if (!opened) {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: strips ANSI colour codes from Vite's banner
    const plain = text.replace(/\x1b\[[0-9;]*m/g, '');
    const m = /Local:\s+(https?:\/\/\S+)/.exec(plain);
    if (m) {
      opened = true;
      const url = m[1]!;
      console.log(`\nPathfinder / Starfinder infographics running at ${url} — press Ctrl+C to stop.\n`);
      if (!args['no-open']) openBrowser(url);
    }
  }
}
process.exit(await vite.exited);
