<script setup lang="ts">
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Cell } from '../games/onde/geo';

export interface Marker extends Cell {
  name: string;
  color: string;
}

const props = defineProps<{
  /** Palpite deste jogador (pode ser movido clicando de novo). */
  guess: Cell | null;
  disabled?: boolean;
  /** Local certo, mostrado só depois da rodada. */
  answer?: Cell | null;
  /** Palpites dos colegas, mostrados só depois da rodada. */
  others?: Marker[];
}>();
const emit = defineEmits<{ pick: [cell: Cell] }>();

const el = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let layer: L.LayerGroup | null = null;

function render() {
  if (!map || !layer) return;
  layer.clearLayers();
  if (props.guess) {
    L.circleMarker([props.guess.lat, props.guess.lon], {
      radius: 9, color: '#2b2925', weight: 3, fillColor: '#d97757', fillOpacity: 1,
    }).addTo(layer);
  }
  if (props.answer) {
    const a = props.answer;
    L.circleMarker([a.lat, a.lon], {
      radius: 11, color: '#2b2925', weight: 3, fillColor: '#4e9e8c', fillOpacity: 1,
    }).bindTooltip('Local certo').addTo(layer);
    for (const m of props.others ?? []) {
      L.polyline([[m.lat, m.lon], [a.lat, a.lon]], { color: m.color, weight: 2, dashArray: '6 6' }).addTo(layer);
      L.circleMarker([m.lat, m.lon], {
        radius: 7, color: '#2b2925', weight: 2, fillColor: m.color, fillOpacity: 1,
      }).bindTooltip(m.name).addTo(layer);
    }
    map.fitBounds(L.latLngBounds([[a.lat, a.lon], ...(props.others ?? []).map((m) => [m.lat, m.lon] as [number, number])]), { padding: [30, 30], maxZoom: 6 });
  }
}

onMounted(() => {
  map = L.map(el.value!, { minZoom: 2, worldCopyJump: true }).setView([20, 0], 2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap',
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  map.on('click', (e: L.LeafletMouseEvent) => {
    if (props.disabled) return;
    emit('pick', { lat: e.latlng.lat, lon: e.latlng.lng });
  });
  setTimeout(() => map?.invalidateSize(), 0);
  render();
});

watch(() => [props.guess, props.answer, props.others, props.disabled], render, { deep: true });

onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
</script>

<template>
  <div ref="el" class="guess-map" :class="{ off: disabled }" />
</template>
