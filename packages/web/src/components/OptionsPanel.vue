<script setup lang="ts">
import { defaultSizeFor, SIZE_PRESETS } from '@pfsf/engine/presets';
import { computed, watch } from 'vue';
import type { GameSummary } from '../engine/protocol';
import type { UiOptions } from '../state/options';
import { eligibleClass, presetExclusions } from '../state/selection';
import HelpTip from './HelpTip.vue';
import RatingNotes from './RatingNotes.vue';

const props = defineProps<{
  game: GameSummary;
  ratingSets: GameSummary[];
  sizing: boolean;
  autoMessage: string;
}>();
const emit = defineEmits<{ auto: []; ratingSet: [id: string] }>();
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

function applyPreset(preset: 'core1' | 'core12' | 'published'): void {
  o.value.exclude = presetExclusions(props.game.classes, preset);
  o.value.includePlaytest = false;
  o.value.includeLegacy = false;
  o.value.maxComplexity = '';
}
const eligible = (c: GameSummary['classes'][number]) =>
  eligibleClass(c, o.value.includePlaytest, o.value.includeLegacy, o.value.maxComplexity);
const hasStatus = (s: string) => props.game.classes.some((c) => c.status === s);

/** Classes that will actually appear, taking the playtest/legacy switches into account. */
const shown = computed(
  () => props.game.classes.filter((c) => !o.value.exclude.includes(c.id) && eligible(c)).length,
);
</script>

<template>
  <section class="panel">
    <h2>Ratings</h2>
    <div class="field">
      <div class="field-label"><label for="rating-set">Rating set</label><HelpTip label="rating set" :text="game.ratingSetDescription" /></div>
      <select id="rating-set" :value="game.ratingSetId" @change="emit('ratingSet', ($event.target as HTMLSelectElement).value)">
        <option v-for="set in ratingSets" :key="set.ratingSetId" :value="set.ratingSetId" :title="set.ratingSetDescription">{{ set.ratingSetName }}</option>
      </select>
    </div>
    <p class="hint">Each set supplies its own class roster, descriptions and scores.</p>
    <RatingNotes :game="game" />
  </section>
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
    <div v-if="o.intent === 'print'" class="field">
      <div class="field-label"><label for="bleed">Bleed (mm)</label><HelpTip label="bleed" text="Adds extra background beyond each page's trim edge, so cutting won't leave white slivers. Use your printer's requested amount (often 3 mm); leave at 0 for home printing. No crop marks are added." /></div>
      <input id="bleed" v-model.number="o.bleed" type="number" min="0" max="18" step="0.5" />
    </div>
    <label v-if="o.layout === 'booklet'" class="check"><input v-model="o.pageNumbers" type="checkbox" /> Page numbers</label>
    <label v-if="o.layout === 'booklet'" class="check"><input v-model="o.repeatSectionTitles" type="checkbox" /> Repeat section titles on each page</label>
  </section>

  <section class="panel">
    <h2>Look</h2>
    <div class="seg" role="radiogroup" aria-label="Theme">
      <label><input v-model="o.theme" type="radio" value="light" /> Light</label>
      <label><input v-model="o.theme" type="radio" value="dark" /> Dark</label>
    </div>
    <label class="check"><input v-model="o.background" type="checkbox" /> Background (off = transparent)</label>
    <div class="color-pickers">
      <label class="field">Background color<input type="color" :value="o.backgroundColor || (o.theme === 'dark' ? '#17161b' : '#ffffff')" :disabled="!o.background" @input="o.backgroundColor = ($event.target as HTMLInputElement).value" /></label>
      <label class="field">Font color<input type="color" :value="o.fontColor || (o.theme === 'dark' ? '#f1ede4' : '#111111')" @input="o.fontColor = ($event.target as HTMLInputElement).value" /></label>
    </div>
    <button v-if="o.backgroundColor || o.fontColor" type="button" class="link" @click="o.backgroundColor = ''; o.fontColor = ''">Reset output colors</button>
    <div class="field">
      <div class="field-label"><label for="rating-colors">Rating colors</label><HelpTip label="rating colors" text="Changes the five rating-bar colors only. Classic uses the original palette; color-blind safe uses more distinct hues; grayscale suits monochrome printing. The scores stay the same." /></div>
      <select id="rating-colors" v-model="o.palette">
        <option value="classic">Classic</option>
        <option value="colorblind">Color-blind safe</option>
        <option value="grayscale">Grayscale</option>
      </select>
    </div>
    <div class="field">
      <div class="text-size-controls">
        <label for="text-size">Text size <span>{{ Math.round(o.fontScale * 100) }}%</span></label>
        <button type="button" class="small" :disabled="sizing" @click="o.fontScale = 1">Default</button>
        <button type="button" class="small" :disabled="sizing || !shown" @click="emit('auto')">{{ sizing ? 'Sizing…' : 'Auto' }}</button>
        <HelpTip label="automatic text size" text="Auto compares every slider size using the rendered layout, balancing readable text with page coverage. Run it again after changing paper, artwork or classes. Default restores 100%." />
      </div>
      <input id="text-size" v-model.number="o.fontScale" type="range" min="0.8" max="1.3" step="0.05" :disabled="sizing" />
      <p v-if="autoMessage" class="hint" role="status">{{ autoMessage }}</p>
    </div>
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
        <option value="groups">By class family</option>
        <option value="alphabetical">Alphabetical</option>
      </select>
    </label>
    <label class="check"><input v-model="o.legend" type="checkbox" /> How-to-use and key</label>
    <label class="check"><input v-model="o.stats" type="checkbox" /> Hit points and source</label>
    <label class="check">
      <input v-model="o.attribution" type="checkbox" /> Credits and notices
    </label>
    <p v-if="!o.attribution" class="hint">
      Please keep credits when sharing: the design is used with permission from Rachelle Willemsma, and included content and artwork retain their own attribution requirements.
    </p>
    <label class="field">Title <input v-model="o.title" type="text" :placeholder="game.title" /></label>
    <label class="field">Content updated <input v-model="o.asOf" type="text" :placeholder="game.asOf" /></label>

    <details class="classes">
      <summary class="class-summary"><svg class="disclosure" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>Choose classes · {{ shown }} selected</summary>
      <p class="hint">Select books, then customize the checkboxes. The count matches your export.</p>
      <div class="row selection-presets">
        <button v-if="game.classes.some(c => c.source === 'Player Core')" type="button" @click="applyPreset('core1')">Player Core</button>
        <button v-if="game.classes.some(c => c.source === 'Player Core 2')" type="button" @click="applyPreset('core12')">Player Core + 2</button>
        <button type="button" @click="applyPreset('published')">All published</button>
      </div>
      <div class="field">
        <div class="field-label"><label for="complexity-limit">Maximum complexity</label><HelpTip label="maximum complexity" text="Uses the upper end of each class's complexity range. Classes without a complexity score are excluded when a limit is selected. Complexity describes preparation and decisions, not who is allowed to play a class." /></div>
        <select id="complexity-limit" v-model="o.maxComplexity">
          <option value="">Any complexity</option>
          <option v-for="n in [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]" :key="n" :value="String(n)">{{ n }} or less</option>
        </select>
      </div>
      <p v-if="shown === 0" class="hint" role="status">No classes match. Select classes or relax the filters to include cards in your export.</p>
      <div class="row">
        <button type="button" @click="setAll(true)">All</button>
        <button type="button" @click="setAll(false)">None</button>
      </div>
      <fieldset v-for="g in groups" :key="g.id">
        <legend>{{ g.label }}</legend>
        <label v-for="c in g.classes" :key="c.id" class="check" :title="`${c.source}${c.iconic ? ` · ${c.iconic}` : ''}`">
          <input
            type="checkbox"
            :checked="!o.exclude.includes(c.id) && eligible(c)"
            :disabled="!eligible(c)"
            @change="toggleClass(c.id, ($event.target as HTMLInputElement).checked)"
          />
          <span class="class-choice-text">{{ c.name }}<small>{{ c.source }}</small><small v-if="!eligible(c)">Excluded by current filters</small></span>
          <span v-if="c.status === 'playtest' || c.status === 'legacy'" class="badge">{{ c.status }}</span>
        </label>
      </fieldset>
    </details>
  </section>
</template>
