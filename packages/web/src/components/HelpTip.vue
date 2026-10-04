<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue';

defineProps<{ label: string; text: string }>();
const id = useId();
const open = ref(false);
const button = ref<HTMLButtonElement>();
const tip = ref<HTMLElement>();
const position = ref({ left: '16px', top: '16px' });
async function show(): Promise<void> {
  open.value = true;
  await nextTick();
  const r = button.value?.getBoundingClientRect();
  if (!r || !tip.value) return;
  const { width, height } = tip.value.getBoundingClientRect();
  position.value = {
    left: `${Math.max(16, Math.min(r.left, innerWidth - width - 16))}px`,
    top: `${r.bottom + height + 12 < innerHeight ? r.bottom + 8 : Math.max(16, r.top - height - 8)}px`,
  };
}
function hide(): void {
  open.value = false;
}
window.addEventListener('scroll', hide, true);
window.addEventListener('resize', hide);
onBeforeUnmount(() => {
  window.removeEventListener('scroll', hide, true);
  window.removeEventListener('resize', hide);
});
</script>

<template>
  <button ref="button" type="button" class="help-tip" :aria-label="`About ${label}`" :aria-describedby="open ? id : undefined" :aria-expanded="open"
    @mouseenter="show" @mouseleave="hide" @focus="show" @blur="hide" @click="show" @keydown.esc.stop="hide">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01" /></svg>
  </button>
  <Teleport to="body">
    <span v-if="open" :id="id" ref="tip" role="tooltip" class="tooltip" :style="position">{{ text }}</span>
  </Teleport>
</template>
