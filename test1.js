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

// 1. 将所有抓取到的实体节点推入配置的 outbounds 数组末尾
config.outbounds.push(...proxies)

// 2. 根据正则匹配，将节点 tag 分发到你模板中带有 Emoji 的策略组里
config.outbounds.map(i => {
  // 匹配所有节点 -> 塞入 ALL 和 ALL-Auto 组
  if (['all', 'all-auto', '🌍 ALL', '🚀 ALL-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies))
  }
  
  // 匹配香港节点 -> 塞入 HK 和 HK-Auto 组
  if (['hk', 'hk-auto', '🇭🇰 HK', '🚀 HK-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies, /港|hk|hongkong|hong kong|🇭🇰/i))
  }
  
  // 匹配台湾节点 -> 塞入 TW 和 TW-Auto 组
  if (['tw', 'tw-auto', '🇼🇸 TW', '🚀 TW-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies, /台|tw|taiwan|🇹🇼/🇼🇸/i))
  }
  
  // 匹配日本节点 -> 塞入 JP 和 JP-Auto 组 (补充了 tokyo, osaka 提高匹配率)
  if (['jp', 'jp-auto', '🇯🇵 JP', '🚀 JP-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies, /日|jp|japan|tokyo|osaka|🇯🇵/i))
  }
  
  // 匹配新加坡节点 -> 塞入 SG 和 SG-Auto 组 (排除了 us 字母，防止误判)
  if (['sg', 'sg-auto', '🇸🇬 SG', '🚀 SG-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies, /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i))
  }
  
  // 匹配美国节点 -> 塞入 US 和 US-Auto 组
  if (['us', 'us-auto', '🇺🇸 US', '🚀 US-Auto'].includes(i.tag)) {
    if (i.outbounds) i.outbounds.push(...getTags(proxies, /美|us|unitedstates|united states|🇺🇸/i))
  }
})

// 3. 兜底容灾处理：如果某个地区的数组是空的（比如你机场没台湾节点），填入 COMPATIBLE (直连)，防止 sing-box 崩溃
config.outbounds.forEach(outbound => {
  if (Array.isArray(outbound.outbounds) && outbound.outbounds.length === 0) {
    if (!compatible) {
      config.outbounds.push(compatible_outbound)
      compatible = true
    }
    outbound.outbounds.push(compatible_outbound.tag);
  }
});

// 输出最终的 JSON 字符串
$content = JSON.stringify(config, null, 2)

// 提取 Tag 的辅助函数
function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
