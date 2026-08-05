// 与后端 pkg/validate 及 frontend/src/components/recognition/recognition-form.tsx 对齐的轻量校验。

const ID_CARD_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CARD_CHECK = '10X98765432';

export function isIdCard(s: string): boolean {
  const v = s.trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += Number(v[i]) * ID_CARD_WEIGHTS[i];
  return v[17] === ID_CARD_CHECK[sum % 11];
}

export function isPhone(s: string): boolean {
  return /^1[3-9]\d{9}$/.test(s.trim());
}

export function formatCurrency(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const parts = rounded.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}
