// Simula N jogadores numa sala: entram, ficam prontos, o host começa e todos
// mandam inputs. Uso: node scripts/load-test.mjs <http://host:porta> [clientes] [segundos]
const base = process.argv[2] ?? 'http://127.0.0.1:8787'
const clientCount = Number(process.argv[3] ?? 10)
const seconds = Number(process.argv[4] ?? 40)
const wsBase = base.replace(/^http/, 'ws')

const { code } = await (await fetch(`${base}/new`)).json()
console.log(`room ${code}, ${clientCount} clients, ${seconds}s`)

const moves = ['up', 'down', 'left', 'right', 'none']
const stats = []
let lobby = null
let started = false
let matchEnded = false

function connect(index) {
  const s = {
    index,
    ws: new WebSocket(`${wsBase}/room/${code}`),
    id: null,
    token: null,
    snapshots: 0,
    lastSnapshotAt: 0,
    maxGapMs: 0,
    sent: 0,
    errors: [],
    timer: null,
  }
  stats.push(s)
  s.ws.onopen = () => {
    s.ws.send(JSON.stringify({ t: 'hello', name: `Bot ${index + 1}` }))
    s.sent += 1
  }
  s.ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.t === 'welcome') {
      s.id = msg.playerId
      s.token = msg.token
    } else if (msg.t === 'lobby') {
      if (index === 0) lobby = msg
      if (index === 0 && !started && msg.players.length === clientCount && msg.players.every((p) => p.ready)) {
        started = true
        s.ws.send(JSON.stringify({ t: 'start' }))
        s.sent += 1
      } else if (!started && msg.players.length === clientCount && !s.readySent) {
        s.readySent = true
        s.ws.send(JSON.stringify({ t: 'ready', ready: true }))
        s.sent += 1
      }
    } else if (msg.t === 'snapshot') {
      const now = Date.now()
      if (s.lastSnapshotAt) s.maxGapMs = Math.max(s.maxGapMs, now - s.lastSnapshotAt)
      s.lastSnapshotAt = now
      s.snapshots += 1
      s.phase = msg.snapshot.phase
    } else if (msg.t === 'matchEnd') {
      matchEnded = true
    } else if (msg.t === 'error') {
      s.errors.push(msg.code)
    }
  }
  s.ws.onclose = () => clearInterval(s.timer)
  return s
}

const clients = Array.from({ length: clientCount }, (_, i) => connect(i))

// Cada cliente manda um input de tempos em tempos, só quando muda (como o cliente real).
for (const s of clients) {
  s.timer = setInterval(() => {
    if (!started || s.ws.readyState !== WebSocket.OPEN) return
    const move = moves[Math.floor(Math.random() * moves.length)]
    const bomb = Math.random() < 0.15
    s.ws.send(JSON.stringify({ t: 'input', move, bomb }))
    s.sent += 1
  }, 400)
}

await new Promise((resolve) => setTimeout(resolve, seconds * 1000))

for (const s of clients) {
  clearInterval(s.timer)
  s.ws.close()
}

const snapTotal = stats.reduce((sum, s) => sum + s.snapshots, 0)
const maxGap = Math.max(...stats.map((s) => s.maxGapMs))
const sent = stats.reduce((sum, s) => sum + s.sent, 0)
const errors = stats.flatMap((s) => s.errors)
console.log(`started: ${started}, matchEnded: ${matchEnded}`)
console.log(`snapshots received: ${snapTotal} (${(snapTotal / clientCount / seconds).toFixed(1)} per client per second)`)
console.log(`max gap between snapshots: ${maxGap} ms`)
console.log(`client messages sent: ${sent}`)
console.log(`errors: ${errors.length ? [...new Set(errors)].join(', ') : 'none'}`)
console.log(`last lobby: ${lobby ? JSON.stringify(lobby.players.map((p) => p.name)) : 'none'}`)
