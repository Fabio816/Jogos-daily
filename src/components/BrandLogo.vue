<script setup lang="ts">
// Marca do app: estrela de 10 pontas com óculos e bigode (paródia, não é o logo de ninguém).
// O mesmo desenho está em public/logo.svg (favicon).
</script>

<template>
  <svg class="brand-mark" viewBox="0 0 248 248" role="img" aria-label="Claudio Games">
    <polygon
      points="124.0,6.0 144.4,61.2 193.4,28.5 177.4,85.2 236.2,87.5 190.0,124.0 236.2,160.5 177.4,162.8 193.4,219.5 144.4,186.8 124.0,242.0 103.6,186.8 54.6,219.5 70.6,162.8 11.8,160.5 58.0,124.0 11.8,87.5 70.6,85.2 54.6,28.5 103.6,61.2"
      fill="#D97757"
      stroke="#B95F42"
      stroke-width="4"
      stroke-linejoin="round"
    />
    <!-- óculos escuros: o Claudio é gente fina -->
    <rect x="58" y="104" width="56" height="30" rx="10" fill="#2b2925" />
    <rect x="134" y="104" width="56" height="30" rx="10" fill="#2b2925" />
    <rect x="112" y="112" width="24" height="7" rx="3" fill="#2b2925" />
    <!-- bigode: a parte que dá nome ao Claudio -->
    <path d="M86 152 Q104 136 124 150 Q144 136 162 152 Q144 162 124 156 Q104 162 86 152 Z" fill="#2b2925" />
  </svg>
</template>
