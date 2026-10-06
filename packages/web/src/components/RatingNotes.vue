<script setup lang="ts">
import type { GameSummary } from '../engine/protocol';

const props = defineProps<{ game: GameSummary }>();
function correction(name = ''): string {
  const query = new URLSearchParams({
    template: 'content-correction.yml',
    title: `${props.game.shortName} / ${props.game.ratingSetName}${name ? ` / ${name}` : ''}: `,
  });
  return `https://github.com/allquixotic/pf-sf-infographics/issues/new?${query}`;
}
</script>

<template>
  <details class="rating-notes" :key="game.ratingSetId">
    <summary class="rating-summary"><svg class="disclosure" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>About these ratings</summary>
    <p>{{ game.methodology }}</p>
    <p>{{ game.ratingSetDescription }}</p>
    <a :href="correction()" target="_blank" rel="noopener">Suggest a correction</a>
    <details v-for="c in game.classes.filter(c => c.review)" :key="c.id" class="review-class">
      <summary class="rating-summary"><svg class="disclosure" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>{{ c.name }} — sources &amp; reasoning</summary>
      <template v-if="c.review">
        <p>{{ c.review.rulesVersion }} · Reviewed {{ c.review.reviewedOn }}</p>
        <p>{{ c.review.notes }}</p>
        <dl><template v-for="(reason, metric) in c.review.ratings" :key="metric"><dt>{{ metric === 'difficulty' ? 'Complexity' : metric }}</dt><dd>{{ reason }}</dd></template></dl>
        <p><a v-for="(url, i) in c.review.sources" :key="url" :href="url" target="_blank" rel="noopener">Source {{ i + 1 }}{{ i + 1 < c.review.sources.length ? ' · ' : '' }}</a></p>
        <a :href="correction(c.name)" target="_blank" rel="noopener">Suggest a correction for {{ c.name }}</a>
      </template>
    </details>
  </details>
</template>
