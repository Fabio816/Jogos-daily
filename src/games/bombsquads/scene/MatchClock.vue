<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import type { MatchClient } from '../match-client'

/**
 * Relógio da partida: prediz o jogador local a 30 Hz e envia input ao servidor
 * só quando muda. Fica dentro do TresCanvas para ter o contexto do useLoop.
 */
const props = defineProps<{ client: MatchClient; keys: ReadonlySet<string> }>()

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  props.client.advance(performance.now(), props.keys)
})
</script>

<template>
  <TresGroup>
  </TresGroup>
</template>
