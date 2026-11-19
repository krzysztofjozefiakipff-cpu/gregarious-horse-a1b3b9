'use strict';

function quarterMonths(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const first = Math.floor((Number(month.slice(5)) - 1) / 3) * 3 + 1;
  return [first, first + 1, first + 2].map(n => month.slice(0, 5) + String(n).padStart(2, '0'));
}

function monthProgress(month, today) {
  if (month < today.slice(0, 7)) return 1;
  if (month > today.slice(0, 7)) return 0;
  const [year, number] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Number(today.slice(8)) / days;
}

function quarterReport(months, today, plans, sales, included = months) {
  let carry = 0;
  return months.map((month, index) => {
    if (!included.includes(month)) {
      carry = 0;
      return null;
    }
    const base = plans[index];
    const sold = sales[index];
    const previousClosed = index === 0 || months[index - 1] < today.slice(0, 7);
    const target = base === null || carry === null || !previousClosed ? null : base + carry;
    const progress = monthProgress(month, today);
    const expected = target === null ? null : target * progress;
    const row = {month, base, carry: target === null ? null : carry, target, sold, progress, expected,
      remaining: target === null ? null : Math.max(0, target - sold)};
    carry = row.remaining;
    return row;
  });
}

if (typeof module !== 'undefined') module.exports = {quarterMonths, monthProgress, quarterReport};
