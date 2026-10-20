<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{ url: string; isPano?: boolean }>();
const emit = defineEmits<{ failed: [] }>();

const wrap = ref<HTMLElement | null>(null);
const isFull = ref(false);
const natural = ref<{ w: number; h: number } | null>(null);
const size = ref({ w: 0, h: 0 });
const zoom = ref(1);
const offset = ref({ x: 0, y: 0 });
const dragging = ref(false);
let last = { x: 0, y: 0 };
let ro: ResizeObserver | null = null;

// Fotos 360° são equiretangulares (2:1). Se a API não disser, deduz pelo formato.
const pano = computed(() => {
  if (props.isPano !== undefined) return props.isPano;
  return natural.value ? Math.abs(natural.value.w / natural.value.h - 2) < 0.05 : false;
});

function fitScale(): number {
  const n = natural.value;
  const s = size.value;
  if (!n || !s.w || !s.h) return 1;
  return Math.max(s.w / n.w, s.h / n.h);
}
const imgW = computed(() => (natural.value ? natural.value.w * fitScale() * zoom.value : 0));
const imgH = computed(() => (natural.value ? natural.value.h * fitScale() * zoom.value : 0));

function clampOffsets() {
  const maxX = imgW.value - size.value.w;
  const maxY = imgH.value - size.value.h;
  if (pano.value && imgW.value > 0) {
    offset.value.x = ((offset.value.x % imgW.value) + imgW.value) % imgW.value;
  } else {
    offset.value.x = Math.min(Math.max(offset.value.x, 0), Math.max(0, maxX));
  }
  offset.value.y = Math.min(Math.max(offset.value.y, 0), Math.max(0, maxY));
}

function centerView() {
  offset.value = {
    x: Math.max(0, (imgW.value - size.value.w) / 2),
    y: Math.max(0, (imgH.value - size.value.h) / 2),
  };
  clampOffsets();
}

function measure(e: Event) {
  const img = e.target as HTMLImageElement;
  if (!img.naturalWidth) return;
  natural.value = { w: img.naturalWidth, h: img.naturalHeight };
  zoom.value = 1;
  centerView();
}

function down(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('button') || !natural.value) return;
  dragging.value = true;
  last = { x: e.clientX, y: e.clientY };
  wrap.value?.setPointerCapture(e.pointerId);
}

function move(e: PointerEvent) {
  if (!dragging.value) return;
  offset.value = { x: offset.value.x - (e.clientX - last.x), y: offset.value.y - (e.clientY - last.y) };
  last = { x: e.clientX, y: e.clientY };
  clampOffsets();
}

function up() {
  dragging.value = false;
}

/** Zoom mantendo o ponto embaixo do cursor parado. */
function zoomAt(next: number, cx: number, cy: number) {
  const before = fitScale() * zoom.value;
  zoom.value = next;
  const after = fitScale() * zoom.value;
  offset.value = {
    x: ((cx + offset.value.x) / before) * after - cx,
    y: ((cy + offset.value.y) / before) * after - cy,
  };
  clampOffsets();
}

function onWheel(e: WheelEvent) {
  const rect = wrap.value?.getBoundingClientRect();
  if (!rect) return;
  const next = Math.min(6, Math.max(1, zoom.value * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
  if (next !== zoom.value) zoomAt(next, e.clientX - rect.left, e.clientY - rect.top);
}

function onDblClick(e: MouseEvent) {
  const rect = wrap.value?.getBoundingClientRect();
  if (!rect) return;
  zoomAt(zoom.value > 1.01 ? 1 : 2, e.clientX - rect.left, e.clientY - rect.top);
}

function toggleFull() {
  isFull.value = !isFull.value;
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFull.value) toggleFull();
}

watch(
  () => props.url,
  () => {
    natural.value = null;
    zoom.value = 1;
    offset.value = { x: 0, y: 0 };
  },
);

onMounted(() => {
  window.addEventListener('keydown', onKey);
  ro = new ResizeObserver(() => {
    const el = wrap.value;
    if (!el) return;
    size.value = { w: el.clientWidth, h: el.clientHeight };
    if (!natural.value) return;
    clampOffsets();
  });
  if (wrap.value) ro.observe(wrap.value);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  ro?.disconnect();
  ro = null;
});
</script>

<template>
  <div
    ref="wrap"
    class="pano-view"
    :class="{ full: isFull, dragging }"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
    @wheel.prevent="onWheel"
    @dblclick="onDblClick"
  >
    <img
      v-if="!natural"
      class="pano-probe"
      :src="url"
      alt=""
      draggable="false"
      @load="measure"
      @error="emit('failed')"
    />
    <template v-else>
      <img
        class="pano-img"
        :src="url"
        alt="Foto de rua para adivinhar o local"
        draggable="false"
        :style="{ width: `${imgW}px`, height: `${imgH}px`, left: `${-offset.x}px`, top: `${-offset.y}px` }"
      />
      <img
        v-if="pano && imgW > 0"
        class="pano-img"
        :src="url"
        alt=""
        draggable="false"
        :style="{ width: `${imgW}px`, height: `${imgH}px`, left: `${imgW - offset.x}px`, top: `${-offset.y}px` }"
      />
    </template>
    <button type="button" class="photo-fs" @click="toggleFull">
      {{ isFull ? '✕ Fechar' : '⛶ Expandir' }}
    </button>
  </div>
</template>
