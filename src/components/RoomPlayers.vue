<script setup lang="ts">
export interface RoomPlayerItem {
  id: string;
  name: string;
  connected?: boolean;
}

defineProps<{
  players: RoomPlayerItem[];
  hostUid?: string;
  myUid?: string;
}>();
</script>

<template>
  <div class="room-players">
    <h3>Jogadores na sala ({{ players.length }})</h3>
    <ul class="players">
      <li v-for="p in players" :key="p.id" :class="{ offline: p.connected === false }">
        {{ p.name }}
        <span v-if="p.id === hostUid" class="tag">host</span>
        <span v-if="p.id === myUid" class="tag you">você</span>
        <span v-if="p.connected === false" class="tag">offline</span>
      </li>
    </ul>
  </div>
</template>
