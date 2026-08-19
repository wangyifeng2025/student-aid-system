/** 从完整通讯地址中拆出「街道/门牌」部分（去掉身份证解析的省市区县前缀）。 */
export function splitRegionDetail(full: string, region: string): string {
  const addr = full.trim();
  const r = region.trim();
  if (!r || !addr.startsWith(r)) return addr;
  return addr.slice(r.length).trim();
}

/** 将身份证解析的省市区县与用户填写的街道门牌拼成完整通讯地址。 */
export function joinRegionDetail(region: string, detail: string): string {
  const r = region.trim();
  const d = detail.trim();
  if (!r) return d;
  if (!d) return r;
  if (d.startsWith(r)) return d;
  return r + d;
}
