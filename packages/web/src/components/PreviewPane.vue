<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  pages: { url: string; width?: number; height?: number }[];
  busy: boolean;
  progress: string;
  warnings: string[];
  error: string;
}>();

const zoomed = ref(false);
</script>

<template>
  <div class="preview" :class="{ busy, zoomed }">
    <div class="status" aria-live="polite">
      <span v-if="busy">{{ progress || 'Rendering…' }}</span>
      <span v-else-if="pages.length">{{ pages.length > 1 ? `${pages.length} pages` : 'Preview' }} · click to zoom</span>
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
        @click="zoomed = !zoomed"
      />
      <p v-if="!pages.length && !busy && !error" class="hint">Loading the layout engine…</p>
    </div>
  </div>
</template>
