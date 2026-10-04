<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GameSummary } from '../engine/protocol';
import HelpTip from './HelpTip.vue';

const props = defineProps<{ game: GameSummary; message: string }>();
const art = defineModel<'paizo' | 'generic' | 'none'>('art', { required: true });
const emit = defineEmits<{ files: [File[], boolean]; forget: [] }>();

const dragging = ref(false);
const paizoPortraits = ref(false);
const input = ref<HTMLInputElement>();

const withArt = computed(() => props.game.classes.filter((c) => c.hasArt).length);
const missing = computed(() => props.game.classes.filter((c) => !c.hasArt).map((c) => c.name));

function onDrop(ev: DragEvent): void {
  dragging.value = false;
  const files = [...(ev.dataTransfer?.files ?? [])];
  if (files.length) emit('files', files, props.game.id === 'pf2e' && paizoPortraits.value);
}

function onPick(ev: Event): void {
  const files = [...((ev.target as HTMLInputElement).files ?? [])];
  if (files.length) emit('files', files, props.game.id === 'pf2e' && paizoPortraits.value);
  (ev.target as HTMLInputElement).value = '';
}
</script>

<template>
  <section class="panel">
    <h2>Artwork</h2>
    <div class="field-label">Custom artwork<HelpTip label="custom artwork" text="Upload images or a ZIP with class names: fighter.png, Witchwarper.svg, or Animist - Samo.jpg. PNG, JPG/JPEG, SVG, WebP and GIF work; folders, case, spaces and separators are ignored. Applied to the selected game. Uploaded art overrides official art; missing classes use emblems." /></div>
    <div class="seg" role="radiogroup" aria-label="Artwork">
      <label><input v-model="art" type="radio" value="paizo" /> Official / custom art</label>
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
      <details v-if="game.id === 'pf2e'" class="portrait-help">
        <summary class="source-summary field-label"><svg class="disclosure" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>Necromancer &amp; Runesmith portraits</summary>
        <p class="hint">Save Wayne Reynolds’s portrait from Paizo’s
          <a href="https://paizo.com/blog/meet-the-iconics-usharak" target="_blank" rel="noopener">Usharak (Necromancer)</a> or
          <a href="https://paizo.com/blog/meet-the-iconics-pallemi" target="_blank" rel="noopener">Pallemi (Runesmith)</a> post.
          Rename it <code>necromancer</code> or <code>runesmith</code>, keeping its image extension, then upload here.
        </p>
        <p class="hint">Blog artwork is covered by <a href="https://paizo.com/licenses/communityuse" target="_blank" rel="noopener">Paizo’s Community Use Policy</a> for eligible free projects. Keep credits and notices enabled when sharing. The pregen PDF’s personal-copy notice does not make its artwork open licensed.</p>
        <label class="check"><input v-model="paizoPortraits" type="checkbox" /> My next uploads are Wayne Reynolds / Paizo portraits (include credits)</label>
      </details>
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
        Drop an official or custom ZIP, or class images named like <code>runesmith.png</code>
        <input ref="input" type="file" accept=".zip,.png,.jpg,.jpeg,.svg,.webp,.gif" multiple hidden @change="onPick" />
      </div>
      <p class="hint">Art found for {{ withArt }} of {{ game.classes.length }} classes.</p>
      <p v-if="missing.length" class="hint">Emblems used for: {{ missing.join(', ') }}.</p>
      <p v-if="message" class="hint art-message" role="status">{{ message }}</p>
      <p class="hint">Settings and uploaded art are saved in this browser when storage is available.</p>
      <button type="button" class="link" @click="emit('forget')">Forget supplied art</button>
    </template>
  </section>
</template>
