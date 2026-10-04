<script setup lang="ts">
import { defaultSizeFor, SIZE_PRESETS } from '@pfsf/engine/presets';
import { computed, watch } from 'vue';
import type { GameSummary } from '../engine/protocol';
import type { UiOptions } from '../state/options';

const props = defineProps<{ game: GameSummary }>();
const o = defineModel<UiOptions>({ required: true });

const presets = computed(() => SIZE_PRESETS.filter((p) => p.intent === o.value.intent));

// Keep the size sensible: a new layout gets its default size; switching print/screen keeps a size only if it exists
// for the new intent.
// Both watchers ignore changes caused by switching to another game tab (a different options object).
watch(
  () => [o.value, o.value.layout] as const,
  ([obj, layout], [prev]) => {
    if (obj !== prev) return;
    if (o.value.size !== 'custom') o.value.size = defaultSizeFor(layout, o.value.intent);
  },
);
watch(
  () => [o.value, o.value.intent] as const,
  ([obj, intent], [prev]) => {
    if (obj !== prev) return;
    const valid = o.value.size === 'fit' || presets.value.some((p) => p.id === o.value.size);
    if (o.value.size === 'custom') o.value.customUnit = intent === 'print' ? 'in' : 'px';
    else if (!valid) o.value.size = defaultSizeFor(o.value.layout, intent);
  },
);

const groups = computed(() =>
  props.game.groups
    .map((g) => ({ ...g, classes: props.game.classes.filter((c) => c.group === g.id) }))
    .filter((g) => g.classes.length > 0),
);

function toggleClass(id: string, on: boolean): void {
  const ex = new Set(o.value.exclude);
  if (on) ex.delete(id);
  else ex.add(id);
  o.value.exclude = [...ex];
}

function setAll(on: boolean): void {
  o.value.exclude = on ? [] : props.game.classes.map((c) => c.id);
}

const hasStatus = (s: string) => props.game.classes.some((c) => c.status === s);

/** Classes that will actually appear, taking the playtest/legacy switches into account. */
const shown = computed(
  () =>
    props.game.classes.filter(
      (c) =>
        !o.value.exclude.includes(c.id) &&
        (c.status !== 'playtest' || o.value.includePlaytest) &&
        (c.status !== 'legacy' || o.value.includeLegacy),
    ).length,
);
</script>

<template>
  <section class="panel">
    <h2>Layout</h2>
    <div class="seg" role="radiogroup" aria-label="Layout">
      <label><input v-model="o.layout" type="radio" value="poster" /> Poster</label>
      <label><input v-model="o.layout" type="radio" value="booklet" /> Booklet</label>
    </div>
    <div class="seg" role="radiogroup" aria-label="Intended use">
      <label><input v-model="o.intent" type="radio" value="print" /> For print</label>
      <label><input v-model="o.intent" type="radio" value="screen" /> For screens</label>
    </div>
    <label class="field">
      Size
      <select v-model="o.size">
        <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.label }}</option>
        <option v-if="o.layout === 'poster'" value="fit">Fit to content</option>
        <option value="custom">Custom…</option>
      </select>
    </label>
    <div v-if="o.size === 'custom'" class="row">
      <input v-model.number="o.customW" type="number" min="1" step="any" aria-label="Width" />
      ×
      <input v-model.number="o.customH" type="number" min="1" step="any" aria-label="Height" />
      <select v-model="o.customUnit" aria-label="Unit">
        <option value="in">in</option>
        <option value="mm">mm</option>
        <option value="px">px</option>
      </select>
    </div>
    <label class="field">
      Orientation
      <select v-model="o.orientation">
        <option value="auto">Automatic</option>
        <option value="landscape">Landscape</option>
        <option value="portrait">Portrait</option>
      </select>
    </label>
    <label v-if="o.intent === 'print'" class="field">
      Bleed (mm)
      <input v-model.number="o.bleed" type="number" min="0" max="18" step="0.5" />
    </label>
    <label v-if="o.layout === 'booklet'" class="check"><input v-model="o.pageNumbers" type="checkbox" /> Page numbers</label>
  </section>

  <section class="panel">
    <h2>Look</h2>
    <div class="seg" role="radiogroup" aria-label="Theme">
      <label><input v-model="o.theme" type="radio" value="light" /> Light</label>
      <label><input v-model="o.theme" type="radio" value="dark" /> Dark</label>
    </div>
    <label class="check"><input v-model="o.background" type="checkbox" /> Background (off = transparent)</label>
    <label class="field">
      Rating colors
      <select v-model="o.palette">
        <option value="classic">Classic</option>
        <option value="colorblind">Color-blind safe</option>
        <option value="grayscale">Grayscale</option>
      </select>
    </label>
    <label class="field">
      Text size
      <input v-model.number="o.fontScale" type="range" min="0.8" max="1.3" step="0.05" />
    </label>
  </section>

  <section class="panel">
    <h2>Contents</h2>
    <label v-if="hasStatus('playtest')" class="check">
      <input v-model="o.includePlaytest" type="checkbox" /> Include playtest classes
    </label>
    <label v-if="hasStatus('legacy')" class="check">
      <input v-model="o.includeLegacy" type="checkbox" /> Include legacy classes
    </label>
    <label class="field">
      Grouping
      <select v-model="o.grouping">
        <option value="groups">By magic ability</option>
        <option value="alphabetical">Alphabetical</option>
      </select>
    </label>
    <label class="check"><input v-model="o.legend" type="checkbox" /> How-to-use and key</label>
    <label class="check"><input v-model="o.stats" type="checkbox" /> Hit points and source</label>
    <label class="check">
      <input v-model="o.attribution" type="checkbox" /> Credits and notices
    </label>
    <p v-if="!o.attribution" class="hint">
      Please keep credits when you share an image: Rachelle Willemsma's license (CC BY) and Paizo's Community Use
      Policy both require them.
    </p>
    <label class="field">Title <input v-model="o.title" type="text" :placeholder="game.title" /></label>
    <label class="field">Accurate as of <input v-model="o.asOf" type="text" :placeholder="game.asOf" /></label>

    <details class="classes">
      <summary>Classes ({{ shown }} shown)</summary>
      <div class="row">
        <button type="button" @click="setAll(true)">All</button>
        <button type="button" @click="setAll(false)">None</button>
      </div>
      <fieldset v-for="g in groups" :key="g.id">
        <legend>{{ g.label }}</legend>
        <label v-for="c in g.classes" :key="c.id" class="check" :title="`${c.source}${c.iconic ? ` · ${c.iconic}` : ''}`">
          <input
            type="checkbox"
            :checked="!o.exclude.includes(c.id)"
            @change="toggleClass(c.id, ($event.target as HTMLInputElement).checked)"
          />
          {{ c.name }}
          <span v-if="c.status === 'playtest'" class="badge">playtest</span>
        </label>
      </fieldset>
    </details>
  </section>
</template>
