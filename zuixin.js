// sing-box 订阅填充脚本（Sub-Store「文件」脚本操作）
// 基于 xream 官方 template.js：
// https://raw.githubusercontent.com/xream/scripts/main/surge/modules/sub-store-scripts/sing-box/template.js
//
// 和官方脚本的区别：
//   1. 地区分组规则内置在下方 RULES，不用再在链接里拼一长串 outbound 参数
//   2. 分组名精确匹配（官方示例参数是子串匹配，tw 会误中 Twitter）
//   3. 订阅一个节点都拿不到时直接报错，不生成「全部直连」的配置，客户端会保留上一份可用配置
//
// 参数（写在脚本链接 # 后面，用 & 连接；粘贴代码使用时改下面的 DEFAULT_*）：
//   name      订阅名称，必填（Sub-Store 里订阅或组合订阅的「名称」）
//   type      组合订阅填 组合订阅；单条订阅不填
//   url       不用 Sub-Store 里的订阅，直接拉这个订阅链接（需 encodeURIComponent）
//   outbound  自定义分组规则，格式同官方脚本；填了就替换下方 RULES
//   includeUnsupportedProxy  填 true 时包含 SSR、Snell 等 sing-box 不支持的协议

const DEFAULT_NAME = '' // 粘贴代码使用时，把订阅名称写在这里
const DEFAULT_TYPE = '' // 组合订阅写 '组合订阅'，单条订阅留空

// 美国节点的 us：前后不能紧挨字母，避免误中 Russia、Australia、Plus
const US = '(^|[^a-z])us(?![a-z])'

// [分组名, 节点名]：节点名匹配的节点会加进分组名匹配的分组
const RULES = [
  [/^(all|all-auto|proxy|GLOBAL|Msx)$/, /.*/],
  [/^hk(-auto)?$/, /港|hk|hong.?kong|🇭🇰/i],
  [/^tw(-auto)?$/, /台|tw|taiwan|🇹🇼/i],
  [/^jp(-auto)?$/, /日本|东京|大阪|jp|japan|tokyo|osaka|🇯🇵/i],
  // 排除美国节点：「美国-新泽西」里的「新」不能让它进新加坡
  [/^sg(-auto)?$/, new RegExp(`^(?!.*(美|🇺🇸|${US})).*(新加坡|狮城|sg|singapore|🇸🇬)`, 'i')],
  [
    /^us(-auto)?$/,
    new RegExp(`美|洛杉矶|圣何塞|硅谷|西雅图|${US}|usa|united.?states|los.?angeles|san.?jose|seattle|🇺🇸`, 'i'),
  ],
]

log('🚀 开始')

const args = typeof $arguments === 'object' && $arguments ? $arguments : {}
const name = args.name || DEFAULT_NAME
const type = /^1$|col|组合/i.test(args.type || DEFAULT_TYPE) ? 'collection' : 'subscription'
const url = args.url
if (!name && !url) {
  throw new Error('缺少订阅名称：在脚本链接后加 #name=订阅名称，或填写脚本里的 DEFAULT_NAME')
}
log(`订阅: ${name || url}（${type === 'collection' ? '组合订阅' : '单条订阅'}）`)

const parser = ProxyUtils.JSON5 || JSON
let config
try {
  config = parser.parse($content ?? $files[0])
} catch (e) {
  throw new Error(`配置文件不是合法的 JSON：${e.message ?? e}`)
}
if (!Array.isArray(config.outbounds)) config.outbounds = []

const produceOpts = { 'include-unsupported-proxy': args.includeUnsupportedProxy }
const raw = await produceArtifact(
  url
    ? { name, type, platform: 'sing-box', produceOpts, subscription: { name, url, source: 'remote' } }
    : { name, type, platform: 'sing-box', produceOpts },
)
const data = JSON.parse(raw)
const outbounds = data.outbounds ?? []
const endpoints = data.endpoints ?? []
const proxies = [...outbounds, ...endpoints]
log(`获取到 ${outbounds.length} 个节点, ${endpoints.length} 个端点`)
if (proxies.length === 0) {
  throw new Error(`订阅「${name || url}」没有可用节点：检查订阅名称、订阅是否过期或拉取失败`)
}

const rules = args.outbound ? parseOutboundArg(args.outbound) : RULES
log(`使用${args.outbound ? '链接参数里的' : '内置'}分组规则，共 ${rules.length} 条`)

for (const ob of config.outbounds) {
  for (const [groupRe, nodeRe] of rules) {
    if (!groupRe.test(ob.tag)) continue
    if (!Array.isArray(ob.outbounds)) ob.outbounds = []
    const tags = proxies.filter(p => nodeRe.test(p.tag)).map(p => p.tag)
    for (const t of tags) if (!ob.outbounds.includes(t)) ob.outbounds.push(t)
    log(`${ob.tag} ← ${tags.length} 个节点`)
  }
}

// 任何分组为空时 sing-box 都无法启动，补一个直连占位
// （官方脚本只检查规则命中的分组，规则没覆盖到的空分组会让整份配置起不来）
let compatible = false
for (const ob of config.outbounds) {
  if (Array.isArray(ob.outbounds) && ob.outbounds.length === 0) {
    if (!compatible) {
      config.outbounds.push({ tag: 'COMPATIBLE', type: 'direct' })
      compatible = true
    }
    ob.outbounds.push('COMPATIBLE')
    log(`${ob.tag} 没有匹配的节点，已放入直连占位 COMPATIBLE`)
  }
}

config.outbounds.push(...outbounds)
if (endpoints.length) {
  if (!Array.isArray(config.endpoints)) config.endpoints = []
  config.endpoints.push(...endpoints)
}

$content = JSON.stringify(config, null, 2)
log('🔚 结束')

// 官方格式：🕳分组名🏷节点名，多条规则用 🕳 连接；ℹ️ 表示忽略大小写；省略 🏷 表示全部节点
function parseOutboundArg(s) {
  return s
    .split('🕳')
    .map(i => i.trim())
    .filter(Boolean)
    .map(i => {
      const [g, n = '.*'] = i.split('🏷')
      return [toRegExp(g), toRegExp(n)]
    })
}
function toRegExp(p) {
  return new RegExp(p.replace('ℹ️', ''), p.includes('ℹ️') ? 'i' : undefined)
}
function log(v) {
  console.log(`[📦 sing-box 填充脚本] ${v}`)
}
