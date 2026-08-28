// sing-box.js
const { type, name } = $arguments
const compatible_outbound = {
  tag: 'COMPATIBLE',
  type: 'direct',
}

// ── QUIC 接收窗口 ───────────────────────────────────────────
// 只调缓冲区上限，不产生任何额外流量，不影响耗电。
// 跨境链路 RTT 高，带宽时延积大，窗口太小会在填满后干等 ACK，限制吞吐。
// 这两个值是上限，按需增长，空闲时不占内存。
// 注意：不设 keep_alive_period —— 保活包会让手机基带频繁唤醒，费电。
const QUIC_TUNE = {
  stream_receive_window: '4 MB',
  connection_receive_window: '8 MB',
}
const QUIC_TYPES = ['hysteria', 'hysteria2', 'tuic']

// BBR 激进档：hy2 上下行留空时走 BBR，这个参数调它抢带宽的积极程度。
// 仍然是 BBR（会响应拥塞信号），不是 Brutal 那种无视丢包硬发，风险可控。
// 只有 hysteria2 支持这个字段，别给 tuic / hysteria v1 加。
// 晚高峰要是反而更差，把 aggressive 改成 standard（默认值）即可。
const HY2_TUNE = { bbr_profile: 'aggressive' }

// ── 地区匹配 ────────────────────────────────────────────────
// 除了国家名，也认常见城市名 —— 机场很多节点叫「东京」「洛杉矶」而不带国名，
// 只匹配国名会让它们落不进地区分组，只能出现在 all 里。
// us 用 \bus\b 而不是裸 us，否则 Russia / Australia / Business 都会被误判成美国。
const REGION = {
  hk: /港|hk|hongkong|hong ?kong|🇭🇰/i,
  tw: /台|tw|taiwan|🇹🇼/i,
  jp: /日本|东京|大阪|名古屋|jp|japan|tokyo|osaka|🇯🇵/i,
  sg: /新|狮城|sg|singapore|🇸🇬/i,
  us: /美|洛杉矶|圣何塞|硅谷|西雅图|达拉斯|凤凰城|\bus\b|usa|united ?states|los ?angeles|san ?jose|seattle|🇺🇸/i,
}

let compatible
let config = JSON.parse($files[0])
let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'sing-box',
  produceType: 'internal',
})

// QUIC 系协议加接收窗口；hysteria2 再加 BBR 档位；TCP 系不动
proxies.forEach(p => {
  if (!p) return
  if (QUIC_TYPES.includes(p.type)) Object.assign(p, QUIC_TUNE)
  if (p.type === 'hysteria2') Object.assign(p, HY2_TUNE)
})

config.outbounds.push(...proxies)

config.outbounds.forEach(i => {
  if (!i.outbounds) return
  // 注意：每个 tag 只能命中一次，否则节点会被重复添加
  if (['all', 'all-auto', 'proxy', 'GLOBAL', 'Msx'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies))
  }
  // 地区分组：选择器额外把自家 -auto 放在首位。
  // 一是「自动选最快」更顺手，二是某地区只有 1 个节点时，选择器不会因为
  // 只剩一个选项而被客户端折叠隐藏（新加坡、美国就是这种情况）。
  for (const r of ['hk', 'tw', 'jp', 'sg', 'us']) {
    if (i.tag === r) i.outbounds.push(`${r}-auto`, ...getTags(proxies, REGION[r]))
    else if (i.tag === `${r}-auto`) i.outbounds.push(...getTags(proxies, REGION[r]))
  }
})

config.outbounds.forEach(outbound => {
  if (Array.isArray(outbound.outbounds) && outbound.outbounds.length === 0) {
    if (!compatible) {
      config.outbounds.push(compatible_outbound)
      compatible = true
    }
    outbound.outbounds.push(compatible_outbound.tag)
  }
})

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
