// sing-box.js
const { type, name } = $arguments
const compatible_outbound = {
  tag: 'COMPATIBLE',
  type: 'direct',
}

let compatible
let config = JSON.parse($files[0])
let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'sing-box',
  produceType: 'internal',
})

config.outbounds.push(...proxies)

config.outbounds.map(i => {
  // 增加了美化后的名字：'🌍 ALL', '⚡ ALL-Auto', '🛜 Proxy', '🌐 Global' 等
  if (['all', 'all-auto', 'proxy', 'GLOBAL', '🌍 ALL', '⚡ ALL-Auto', '🛜 Proxy', '🌐 Global'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies))
  }
  if (['hk', 'hk-auto', '🇭🇰 HK', '⚡ HK-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies, /港|hk|hongkong|hong kong|🇭🇰/i))
  }
  if (['tw', 'tw-auto', '🇹🇼 TW', '⚡ TW-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies, /台|tw|taiwan|🇹🇼/i))
  }
  if (['jp', 'jp-auto', '🇯🇵 JP', '⚡ JP-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies, /日本|jp|japan|🇯🇵/i))
  }
  if (['sg', 'sg-auto', '🇸🇬 SG', '⚡ SG-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies, /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i))
  }
  if (['us', 'us-auto', '🇺🇸 US', '⚡ US-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies, /美|us|unitedstates|united states|🇺🇸/i))
  }
})

config.outbounds.forEach(outbound => {
  if (Array.isArray(outbound.outbounds) && outbound.outbounds.length === 0) {
    if (!compatible) {
      config.outbounds.push(compatible_outbound)
      compatible = true
    }
    outbound.outbounds.push(compatible_outbound.tag);
  }
});

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
