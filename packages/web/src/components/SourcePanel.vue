<script setup lang="ts">
import { ref, watch } from 'vue';
import type { SourceSpec } from '../engine/protocol';

const props = defineProps<{ source: SourceSpec; label: string; warnings: string[] }>();
const emit = defineEmits<{ apply: [SourceSpec] }>();

const kind = ref<SourceSpec['kind']>(props.source.kind);
const repo = ref(
  props.source.kind === 'github' ? props.source.spec : __PFSF_REPO__ ? `${__PFSF_REPO__}@main` : '',
);
const url = ref(props.source.kind === 'url' ? props.source.url : '');

watch(
  () => props.source,
  (s) => {
    kind.value = s.kind;
    if (s.kind === 'github') repo.value = s.spec;
    if (s.kind === 'url') url.value = s.url;
  },
);

function apply(): void {
  if (kind.value === 'github') emit('apply', { kind: 'github', spec: repo.value.trim() });
  else if (kind.value === 'url') emit('apply', { kind: 'url', url: url.value.trim() });
  else emit('apply', { kind: 'bundled' });
}
</script>

<template>
  <section class="panel">
    <details>
      <summary class="source-summary"><h2><svg class="disclosure" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>Content source</h2></summary>
      <p class="hint">
        Render from any GitHub repository or branch that follows the content format, e.g. your fork:
        <code>you/pf-sf-infographics@my-branch</code>.
      </p>
      <label class="check"><input v-model="kind" type="radio" value="bundled" /> Built-in content</label>
      <label class="check"><input v-model="kind" type="radio" value="github" /> GitHub repository</label>
      <input v-if="kind === 'github'" v-model="repo" type="text" placeholder="owner/repo@branch:content" />
      <label class="check"><input v-model="kind" type="radio" value="url" /> Other URL</label>
      <input v-if="kind === 'url'" v-model="url" type="url" placeholder="https://example.org/content/" />
      <button type="button" @click="apply">Load</button>
      <p class="hint">Loaded: <code>{{ label }}</code></p>
      <ul v-if="warnings.length" class="warnings">
        <li v-for="w in warnings" :key="w">{{ w }}</li>
      </ul>
    </details>
  </section>
</template>
