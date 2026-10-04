<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GameSummary } from '../engine/protocol';

const props = defineProps<{ game: GameSummary; message: string }>();
const art = defineModel<'paizo' | 'generic' | 'none'>('art', { required: true });
const emit = defineEmits<{ files: [File[]]; forget: [] }>();

const dragging = ref(false);
const input = ref<HTMLInputElement>();

const withArt = computed(() => props.game.classes.filter((c) => c.hasArt).length);
const missing = computed(() => props.game.classes.filter((c) => !c.hasArt).map((c) => c.name));

function onDrop(ev: DragEvent): void {
  dragging.value = false;
  const files = [...(ev.dataTransfer?.files ?? [])];
  if (files.length) emit('files', files);
}

function onPick(ev: Event): void {
  const files = [...((ev.target as HTMLInputElement).files ?? [])];
  if (files.length) emit('files', files);
  (ev.target as HTMLInputElement).value = '';
}
</script>

<template>
  <section class="panel">
    <h2>Artwork</h2>
    <div class="seg" role="radiogroup" aria-label="Artwork">
      <label><input v-model="art" type="radio" value="paizo" /> Official iconics</label>
      <label><input v-model="art" type="radio" value="generic" /> Emblems</label>
      <label><input v-model="art" type="radio" value="none" /> None</label>
    </div>

    <template v-if="art === 'paizo'">
      <p class="hint">
        Official art is never bundled with this site. Download Paizo's free Community Use Package portraits and drop
        the zip here; it stays in this browser.
      </p>
      <ul class="packs">
        <li v-for="p in game.artPacks" :key="p.id">
          <span :class="p.loaded ? 'ok' : 'todo'">{{ p.loaded ? '✓' : '•' }}</span>
          <a v-if="p.url" :href="p.url" rel="noopener">{{ p.fileName ?? p.label }}</a>
          <span v-else>{{ p.label }}</span>
        </li>
      </ul>
      <div
        class="drop"
        :class="{ over: dragging }"
        role="button"
        tabindex="0"
        @click="input?.click()"
        @keydown.enter.space.prevent="input?.click()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        Drop a Community Use Package zip, or class images named like <code>runesmith.png</code>
        <input ref="input" type="file" accept=".zip,.png,.jpg,.jpeg,.svg" multiple hidden @change="onPick" />
      </div>
      <p class="hint">Art found for {{ withArt }} of {{ game.classes.length }} classes.</p>
      <p v-if="missing.length" class="hint">Emblems used for: {{ missing.join(', ') }}.</p>
      <p v-if="message" class="hint">{{ message }}</p>
      <button type="button" class="link" @click="emit('forget')">Forget supplied art</button>
    </template>
  </section>
</template>
