const { type, name } = $arguments;

// 解析原配置
const config = JSON.parse($files[0]);

// 拉取订阅/合集
const proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'sing-box',
  produceType: 'internal'
});

// 将所有节点追加到 outbounds
config.outbounds.push(...proxies);

// 预备兼容直连
const compatibleOutbound = {
  tag: 'COMPATIBLE',
  type: 'direct'
};
let compatibleInjected = false;

// 根据国家/地区关键字映射 selector
const regionMatchers = [
  { tags: ['all', 'all-auto'], regex: null },
  { tags: ['hk', 'hk-auto'], regex: /港|hk|hongkong|hong kong|🇭🇰/i },
  { tags: ['tw', 'tw-auto'], regex: /台|tw|taiwan|🇹🇼/i },
  { tags: ['jp', 'jp-auto'], regex: /日本|jp|japan|🇯🇵/i },
  { tags: ['sg', 'sg-auto'], regex: /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i },
  { tags: ['us', 'us-auto'], regex: /美|us|unitedstates|united states|🇺🇸/i }
];

// 追加节点到各 selector/urltest（仅对包含 outbounds 数组的结构）
config.outbounds.forEach(outbound => {
  if (!Array.isArray(outbound.outbounds)) return;

  const matcher = regionMatchers.find(m => m.tags.includes(outbound.tag));
  if (!matcher) return;

  const tagsToAdd = getTags(proxies, matcher.regex);
  appendUnique(outbound.outbounds, tagsToAdd);
});

// selector/urltest 无节点时追加 COMPATIBLE
config.outbounds.forEach(outbound => {
  if (!Array.isArray(outbound.outbounds)) return;

  if (outbound.outbounds.length === 0) {
    if (!compatibleInjected) {
      config.outbounds.push(compatibleOutbound);
      compatibleInjected = true;
    }
    outbound.outbounds.push(compatibleOutbound.tag);
  }
});

$content = JSON.stringify(config, null, 2);

function getTags(list, regex) {
  return (regex ? list.filter(p => regex.test(p.tag)) : list).map(p => p.tag);
}

function appendUnique(target, items) {
  items.forEach(tag => {
    if (!target.includes(tag)) {
      target.push(tag);
    }
  });
}
