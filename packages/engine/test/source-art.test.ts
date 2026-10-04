import { describe, expect, test } from 'bun:test';
import { ArtLibrary, ArtPack } from '../src/art/library';
import { githubRawBaseUrl, parseGitHubLocation, resolvePath } from '../src/content/source';

describe('resolvePath', () => {
  test('resolves relative to the referencing file', () => {
    expect(resolvePath('pf2e/game.json', '../shared/x.svg')).toBe('shared/x.svg');
    expect(resolvePath('pf2e/classes/a.json', '../emblems/a.svg')).toBe('pf2e/emblems/a.svg');
  });
  test('refuses to escape the root', () => {
    expect(() => resolvePath('game.json', '../../etc/passwd')).toThrow();
  });
});

describe('GitHub locations', () => {
  test('short form with ref and dir', () => {
    expect(parseGitHubLocation('me/repo@dev:data')).toEqual({
      owner: 'me',
      repo: 'repo',
      ref: 'dev',
      dir: 'data',
    });
  });
  test('defaults', () => {
    expect(parseGitHubLocation('me/repo')).toEqual({
      owner: 'me',
      repo: 'repo',
      ref: 'main',
      dir: 'content',
    });
  });
  test('github.com tree URLs', () => {
    expect(parseGitHubLocation('https://github.com/me/repo/tree/feature/content')).toEqual({
      owner: 'me',
      repo: 'repo',
      ref: 'feature',
      dir: 'content',
    });
  });
  test('raw base URL', () => {
    expect(githubRawBaseUrl({ owner: 'me', repo: 'r', ref: 'main' })).toBe(
      'https://raw.githubusercontent.com/me/r/main/content/',
    );
  });
});

describe('ArtLibrary', () => {
  const png = new Uint8Array([1, 2, 3]);
  const pack = ArtPack.fromFiles(
    'cup',
    'CUP',
    new Map([
      ['PNG/Swashbuckler - Jirrelle.png', png],
      ['JPG/Swashbuckler - Jirrelle.jpg', png],
    ]),
  );

  test('finds art by exact path or by class name', () => {
    expect(pack.find('png/swashbuckler - jirrelle.png')).toBe('PNG/Swashbuckler - Jirrelle.png');
    expect(pack.findByClassName('Swashbuckler')).toBe('PNG/Swashbuckler - Jirrelle.png');
  });

  test('local images override packs', () => {
    const lib = new ArtLibrary();
    lib.addPack(pack);
    lib.addLocal('pf2e', 'Swashbuckler.JPG', new Uint8Array([9]));
    const hit = lib.resolve({
      game: 'pf2e',
      classId: 'swashbuckler',
      className: 'Swashbuckler',
      paizo: { pack: 'cup', file: 'x.png' },
    });
    expect(hit?.ext).toBe('jpg');
    expect(hit?.officialPack).toBeUndefined();
    const other = lib.resolve({
      game: 'sf2e',
      classId: 'swashbuckler',
      className: 'Swashbuckler',
      paizo: { pack: 'cup', file: 'x.png' },
    });
    expect(other?.ext).toBe('png');
    expect(other?.officialPack).toBe('cup');
  });
});

describe('custom artwork', () => {
  const data = new Uint8Array([1, 2, 3]);
  const pack = ArtPack.fromFiles(
    'custom',
    'Custom',
    new Map([
      ['__MACOSX/._Fighter.png', data],
      ['nested/._Fighter.png', data],
      ['nested/FIGHTER (Valeros).JPEG', data],
      ['nested/animist_samo.WEBP', data],
      ['more/Witchwarper--Zemir.GIF', data],
      ['nested/witch.SVG', data],
    ]),
  );

  test('V4: nested archives match class names without matching longer class names', () => {
    expect(pack.findByClassName('fighter')).toBe('nested/FIGHTER (Valeros).JPEG');
    expect(pack.findByClassName('Animist')).toBe('nested/animist_samo.WEBP');
    expect(pack.findByClassName('Witch')).toBe('nested/witch.SVG');
    expect(pack.findByClassName('Witchwarper')).toBe('more/Witchwarper--Zemir.GIF');
    expect(pack.fileNames).toHaveLength(4);
  });

  test('custom packs are scoped to a game and loose images override them', () => {
    const lib = new ArtLibrary();
    lib.addCustomPack('pf2e', pack);
    const req = { game: 'pf2e', classId: 'animist', className: 'Animist' };
    expect(lib.resolve(req)?.ext).toBe('webp');
    expect(lib.resolve({ ...req, game: 'sf2e' })).toBeUndefined();
    lib.addLocal('pf2e', 'Animist - my art.PNG', data);
    expect(lib.resolve(req)?.ext).toBe('png');
  });

  test('exact class filenames beat portrait suffixes and do not match substrings', () => {
    const files = ArtPack.fromFiles(
      'test',
      'Test',
      new Map([
        ['Fighter - alternate.png', data],
        ['Fighter.svg', data],
        ['witchwarper.png', data],
      ]),
    );
    expect(files.findByClassName('fighter')).toBe('Fighter.svg');
    expect(files.findByClassName('witch')).toBeUndefined();
  });
});
