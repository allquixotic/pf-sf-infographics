<script setup lang="ts">
import { zipSync } from 'fflate';
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import ArtPanel from './components/ArtPanel.vue';
import OptionsPanel from './components/OptionsPanel.vue';
import PreviewPane from './components/PreviewPane.vue';
import SourcePanel from './components/SourcePanel.vue';
import { EngineClient } from './engine/client';
import type { ContentSummary, GameSummary, OutFile, SourceSpec } from './engine/protocol';
import { defaultUiOptions, toRenderOptions, type UiOptions } from './state/options';
import { allArt, clearArt, loadJson, putArt, saveJson } from './state/persist';

const LOCAL = __PFSF_LOCAL__;
const engine = new EngineClient();

const summary = shallowRef<ContentSummary>();
const loadError = ref('');
const gameId = ref(loadJson('pfsf:game', { id: 'pf2e' }).id);
const optionsByGame = reactive<Record<string, UiOptions>>(loadJson('pfsf:options', {}));
const source = ref<SourceSpec>(initialSource());

const game = computed<GameSummary | undefined>(() => summary.value?.games.find((g) => g.id === gameId.value));
const ui = computed<UiOptions>(() => {
  if (!optionsByGame[gameId.value]) optionsByGame[gameId.value] = defaultUiOptions();
  return optionsByGame[gameId.value]!;
});

function initialSource(): SourceSpec {
  const q = new URLSearchParams(location.search);
  const repo = q.get('repo');
  if (repo) return { kind: 'github', spec: repo };
  const url = q.get('content');
  if (url) return { kind: 'url', url };
  return { kind: 'bundled' };
}

// ---------------------------------------------------------------------------------------------------------------
// Content and art
// ---------------------------------------------------------------------------------------------------------------

async function loadSource(spec: SourceSpec): Promise<void> {
  loadError.value = '';
  try {
    summary.value = await engine.call({ type: 'load', source: spec });
    source.value = spec;
    if (!summary.value.games.some((g) => g.id === gameId.value))
      gameId.value = summary.value.games[0]?.id ?? 'pf2e';
    const url = new URL(location.href);
    url.searchParams.delete('repo');
    url.searchParams.delete('content');
    if (spec.kind === 'github') url.searchParams.set('repo', spec.spec);
    if (spec.kind === 'url') url.searchParams.set('content', spec.url);
    history.replaceState(null, '', url);
  } catch (err) {
    loadError.value = (err as Error).message;
  }
}

async function refreshSummary(): Promise<void> {
  summary.value = await engine.call({ type: 'summary' });
}

const artMessage = ref('');

async function addArtFiles(files: File[], targetGame: string): Promise<void> {
  const messages: string[] = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    if (/\.zip$/i.test(file.name)) {
      const { packs } = await engine.call({ type: 'addZip', name: file.name, bytes: bytes.slice(0) });
      if (packs.length) {
        messages.push(`${file.name}: recognised`);
        await putArt({ key: `zip:${file.name}`, kind: 'zip', name: file.name, bytes });
      } else messages.push(`${file.name}: not a known art pack`);
    } else if (/\.(png|jpe?g|svg)$/i.test(file.name)) {
      await engine.call({ type: 'addImage', game: targetGame, name: file.name, bytes: bytes.slice(0) });
      await putArt({
        key: `img:${targetGame}/${file.name}`,
        kind: 'image',
        game: targetGame,
        name: file.name,
        bytes,
      });
      messages.push(`${file.name}: added for ${targetGame}`);
    } else messages.push(`${file.name}: unsupported file type`);
  }
  artMessage.value = messages.join(' · ');
  await refreshSummary();
}

async function forgetArt(): Promise<void> {
  await engine.call({ type: 'clearArt' });
  await clearArt();
  artMessage.value = 'Removed all supplied art from this browser.';
  await refreshSummary();
}

async function restoreArt(): Promise<void> {
  for (const item of await allArt()) {
    if (item.kind === 'zip') await engine.call({ type: 'addZip', name: item.name, bytes: item.bytes });
    else
      await engine.call({ type: 'addImage', game: item.game ?? 'pf2e', name: item.name, bytes: item.bytes });
  }
  if (LOCAL) {
    // The local launcher exposes ./local-assets (never part of a build).
    try {
      const index = (await (await fetch(`${import.meta.env.BASE_URL}__local-assets/index.json`)).json()) as {
        files: string[];
      };
      for (const f of index.files) {
        const zip = /^paizo\/[^/]+\.zip$/i.test(f);
        const img = /^art\/([^/]+)\/([^/]+\.(png|jpe?g|svg))$/i.exec(f);
        if (!zip && !img) continue;
        const bytes = await (await fetch(`${import.meta.env.BASE_URL}__local-assets/${f}`)).arrayBuffer();
        if (zip)
          await engine.call({ type: 'addZip', name: f.split('/').pop()!, bytes }, { transfer: [bytes] });
        else
          await engine.call(
            { type: 'addImage', game: img![1]!, name: img![2]!, bytes },
            { transfer: [bytes] },
          );
      }
    } catch {
      // No local assets.
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Preview and export
// ---------------------------------------------------------------------------------------------------------------

const pages = ref<{ url: string; width?: number; height?: number }[]>([]);
const warnings = ref<string[]>([]);
const busy = ref(false);
const progress = ref('');
const renderError = ref('');
let renderSeq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function schedulePreview(): void {
  clearTimeout(timer);
  timer = setTimeout(renderPreview, 350);
}

async function renderPreview(): Promise<void> {
  if (!summary.value || !game.value) return;
  const seq = ++renderSeq;
  busy.value = true;
  renderError.value = '';
  try {
    const res = await engine.call(
      { type: 'render', options: toRenderOptions(gameId.value, ui.value, 'svg') },
      { progress: (m) => (progress.value = m) },
    );
    if (seq !== renderSeq) return;
    for (const p of pages.value) URL.revokeObjectURL(p.url);
    pages.value = res.files.map((f) => ({
      url: URL.createObjectURL(new Blob([f.data], { type: f.mime })),
      width: f.width,
      height: f.height,
    }));
    warnings.value = res.warnings;
  } catch (err) {
    if (seq === renderSeq) renderError.value = (err as Error).message;
  } finally {
    if (seq === renderSeq) {
      busy.value = false;
      progress.value = '';
    }
  }
}

const exporting = ref(false);

function download(name: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

async function exportFile(): Promise<void> {
  if (!game.value) return;
  exporting.value = true;
  renderError.value = '';
  try {
    const res = await engine.call(
      { type: 'render', options: toRenderOptions(gameId.value, ui.value, ui.value.format) },
      { progress: (m) => (progress.value = m) },
    );
    warnings.value = res.warnings;
    const files: OutFile[] = res.files;
    if (files.length === 1) download(files[0]!.name, new Blob([files[0]!.data], { type: files[0]!.mime }));
    else {
      const zipped = zipSync(Object.fromEntries(files.map((f) => [f.name, new Uint8Array(f.data)])), {
        level: 0,
      });
      download(
        `${gameId.value}-${ui.value.layout}-${ui.value.format}.zip`,
        new Blob([zipped], { type: 'application/zip' }),
      );
    }
  } catch (err) {
    renderError.value = (err as Error).message;
  } finally {
    exporting.value = false;
    progress.value = '';
  }
}

watch(
  optionsByGame,
  () => {
    saveJson('pfsf:options', optionsByGame);
    schedulePreview();
  },
  { deep: true },
);
watch(gameId, (id) => {
  saveJson('pfsf:game', { id });
  schedulePreview();
});
watch(summary, schedulePreview);

onMounted(async () => {
  await loadSource(source.value);
  await restoreArt();
  if (summary.value) await refreshSummary();
  if (import.meta.hot) {
    import.meta.hot.on('pfsf:content-changed', async () => {
      await loadSource(source.value);
    });
  }
});

const theme = computed(() => ui.value.theme);
</script>

<template>
  <div class="app" :data-preview-theme="theme">
    <header class="top">
      <div class="brand">
        <h1>Class Infographics</h1>
        <p class="tagline">Pathfinder&nbsp;2e &amp; Starfinder&nbsp;2e class overviews, in the style of Rachelle Willemsma's chart.</p>
      </div>
      <nav class="tabs" role="tablist" aria-label="Game">
        <button
          v-for="g in summary?.games ?? []"
          :key="g.id"
          role="tab"
          :aria-selected="g.id === gameId"
          :class="{ active: g.id === gameId }"
          @click="gameId = g.id"
        >
          {{ g.shortName }}
        </button>
      </nav>
    </header>

    <div v-if="LOCAL" class="local-banner">
      Local mode: content is read live from <code>content/</code> and art from <code>local-assets/</code>. Edits reload
      automatically.
    </div>
    <div v-if="loadError" class="error" role="alert">Could not load content: {{ loadError }}</div>

    <main class="layout">
      <aside class="sidebar">
        <template v-if="game">
          <OptionsPanel v-model="optionsByGame[gameId]!" :game="game" />
          <ArtPanel
            v-model:art="optionsByGame[gameId]!.art"
            :game="game"
            :message="artMessage"
            @files="(files: File[]) => addArtFiles(files, gameId)"
            @forget="forgetArt"
          />
        </template>
        <SourcePanel :source="source" :label="summary?.sourceLabel ?? ''" :warnings="summary?.warnings ?? []" @apply="loadSource" />
      </aside>

      <section class="main">
        <div class="export" v-if="game">
          <label>
            Format
            <select v-model="ui.format">
              <option value="pdf">PDF</option>
              <option value="svg">SVG</option>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
          <label v-if="['png', 'jpg', 'webp'].includes(ui.format) && ui.intent === 'print'">
            DPI <input v-model.number="ui.dpi" type="number" min="36" max="1200" step="1" />
          </label>
          <label v-if="['png', 'jpg', 'webp'].includes(ui.format) && ui.intent === 'screen'">
            Scale <input v-model.number="ui.scale" type="number" min="0.25" max="8" step="0.25" />
          </label>
          <label v-if="['jpg', 'webp'].includes(ui.format)">
            Quality <input v-model.number="ui.quality" type="number" min="1" max="100" />
          </label>
          <button class="primary" :disabled="exporting || !summary" @click="exportFile">
            {{ exporting ? 'Rendering…' : 'Download' }}
          </button>
        </div>
        <PreviewPane
          :pages="pages"
          :busy="busy || exporting"
          :progress="progress"
          :warnings="warnings"
          :error="renderError"
        />
      </section>
    </main>

    <footer class="foot">
      <p>
        Layout after the
        <a href="https://willemsma.design/pathfinder/" target="_blank" rel="noopener">Pathfinder 2E Classes Infographic</a>
        by Rachelle Willemsma (CC BY 4.0). Posted with permission of Rachelle Willemsma. Software Apache-2.0; content CC BY 4.0.
      </p>
      <p class="cup">
        This website uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy
        (<a href="https://paizo.com/licenses/communityuse" target="_blank" rel="noopener">paizo.com/licenses/communityuse</a>).
        We are expressly prohibited from charging you to use or access this content. This website is not published,
        endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit
        <a href="https://paizo.com" target="_blank" rel="noopener">paizo.com</a>.
      </p>
    </footer>
  </div>
</template>
