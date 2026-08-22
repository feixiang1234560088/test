// sing-box.js
const { type, name } = $arguments
const compatible_outbound = {
  tag: 'COMPATIBLE',
  type: 'direct',
}

// ── TCP 保活 ────────────────────────────────────────────────
// sing-box 默认空闲 5 分钟才发第一个保活包，间隔 75s。对不少运营商 NAT 来说
// 太晚：表项被老化后连接静默死亡，下次用要等 TCP 重传退避约 20 秒才重建，
// 表现就是「停一会儿再点，卡 20 秒」。改成 60s 首发 / 30s 间隔。
// QUIC 系协议不走 TCP，这两个字段对它们无意义，跳过。
const KEEPALIVE = { tcp_keep_alive: '60s', tcp_keep_alive_interval: '30s' }
const UDP_TYPES = ['hysteria', 'hysteria2', 'tuic', 'wireguard']

// ── 地区匹配 ────────────────────────────────────────────────
// 除了国家名，也认常见城市名 —— 机场很多节点叫「东京」「洛杉矶」而不带国名，
// 只匹配国名会让它们落不进地区分组，只能出现在 all 里。
// us 用 \bus\b 而不是裸 us，否则 Russia / Australia / Business 都会被误判成美国。
const REGION = {
  hk: /港|hk|hongkong|hong ?kong|🇭🇰/i,
  tw: /台|tw|taiwan|🇹🇼/i,
  jp: /日本|东京|大阪|名古屋|jp|japan|tokyo|osaka|🇯🇵/i,
  sg: /新|新加坡|狮城|sg|singapore|🇸🇬/i,
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

// 给每个基于 TCP 的节点出站注入保活
proxies.forEach(p => {
  if (p && !UDP_TYPES.includes(p.type)) Object.assign(p, KEEPALIVE)
})

config.outbounds.push(...proxies)

config.outbounds.forEach(i => {
  if (!i.outbounds) return
  // 注意：每个 tag 只能命中一次，否则节点会被重复添加
  if (['all', 'all-auto', 'proxy', 'GLOBAL', 'Msx'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies))
  }
  if (['hk', 'hk-auto'].includes(i.tag)) i.outbounds.push(...getTags(proxies, REGION.hk))
  if (['tw', 'tw-auto'].includes(i.tag)) i.outbounds.push(...getTags(proxies, REGION.tw))
  if (['jp', 'jp-auto'].includes(i.tag)) i.outbounds.push(...getTags(proxies, REGION.jp))
  if (['sg', 'sg-auto'].includes(i.tag)) i.outbounds.push(...getTags(proxies, REGION.sg))
  if (['us', 'us-auto'].includes(i.tag)) i.outbounds.push(...getTags(proxies, REGION.us))
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
