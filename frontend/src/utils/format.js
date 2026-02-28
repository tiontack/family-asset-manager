export function formatAmount(amount) {
  if (amount == null) return '-';
  return amount.toLocaleString('ko-KR') + '원';
}

export function formatAmountShort(amount) {
  if (amount == null) return '-';
  const abs = Math.abs(amount);
  if (abs >= 100000000) return (amount / 100000000).toFixed(1) + '억';
  if (abs >= 10000) return (amount / 10000).toFixed(0) + '만';
  return amount.toLocaleString('ko-KR');
}

export function formatMonth(month) {
  if (!month) return '';
  const [year, mon] = month.split('-');
  return `${year}년 ${parseInt(mon)}월`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '.');
}

export function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function percentChange(current, prev) {
  if (!prev || prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}
