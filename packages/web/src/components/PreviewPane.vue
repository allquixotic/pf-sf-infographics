<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { loadJson, saveJson } from '../state/persist';

defineProps<{
  pages: { url: string; width?: number; height?: number }[];
  busy: boolean;
  progress: string;
  warnings: string[];
  error: string;
}>();

const zoomed = ref(loadJson('pfsf:preview', { zoomed: false }).zoomed);
watch(zoomed, (value) => saveJson('pfsf:preview', { zoomed: value }));
const expanded = ref(false);
const pane = ref<HTMLElement>();
const expandButton = ref<HTMLButtonElement>();
let previousOverflow = '';
let previousInert = false;
let previousFocus: HTMLElement | null = null;
watch(expanded, async (value) => {
  const app = document.getElementById('app');
  if (value) {
    previousFocus = document.activeElement as HTMLElement;
    previousOverflow = document.body.style.overflow;
    previousInert = app?.inert ?? false;
    await nextTick();
    document.body.style.overflow = 'hidden';
    if (app) app.inert = true;
    expandButton.value?.focus();
  } else {
    document.body.style.overflow = previousOverflow;
    if (app) app.inert = previousInert;
    await nextTick();
    previousFocus?.focus();
  }
});
function onKey(ev: KeyboardEvent): void {
  if (!expanded.value) return;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    expanded.value = false;
  }
  if (ev.key === 'Tab') {
    const items = [...(pane.value?.querySelectorAll<HTMLElement>('button, [tabindex="0"]') ?? [])];
    const first = items[0];
    const last = items.at(-1);
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last?.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first?.focus();
    }
  }
}
window.addEventListener('keydown', onKey);
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  if (expanded.value) {
    document.body.style.overflow = previousOverflow;
    const app = document.getElementById('app');
    if (app) app.inert = previousInert;
  }
});
</script>

<template>
  <Teleport to="body" :disabled="!expanded">
  <div ref="pane" class="preview" :class="{ busy, zoomed, expanded }" :role="expanded ? 'dialog' : undefined" :aria-modal="expanded ? true : undefined" aria-label="Infographic preview">
    <div class="preview-toolbar">
    <div class="status" aria-live="polite">
      <span v-if="busy">{{ progress || 'Rendering…' }}</span>
      <span v-else-if="pages.length">{{ pages.length > 1 ? `${pages.length} pages` : 'Preview' }} · click to zoom</span>
    </div>
      <button ref="expandButton" type="button" class="preview-expand" :aria-label="expanded ? 'Close fullscreen preview' : 'Expand preview'" :title="expanded ? 'Close fullscreen (Escape)' : 'Fullscreen preview'" @click="expanded = !expanded">
        <svg v-if="expanded" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H3v6M3 3l7 7m5 11h6v-6m0 6L14 14" /></svg>
      </button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <ul v-if="warnings.length" class="warnings">
      <li v-for="w in warnings" :key="w">{{ w }}</li>
    </ul>
    <div class="pages" :class="{ multi: pages.length > 1 }">
      <img
        v-for="(p, i) in pages"
        :key="p.url"
        :src="p.url"
        :alt="`Infographic preview, page ${i + 1}`"
        :style="p.width && p.height ? { aspectRatio: `${p.width} / ${p.height}` } : undefined"
        role="button"
        tabindex="0"
        :aria-label="`${zoomed ? 'Zoom out' : 'Zoom in'}, page ${i + 1}`"
        @keydown.enter.space.prevent="zoomed = !zoomed"
        @click="zoomed = !zoomed"
      />
      <p v-if="!pages.length && !busy && !error" class="hint">Loading the layout engine…</p>
    </div>
  </div>
  </Teleport>
</template>
