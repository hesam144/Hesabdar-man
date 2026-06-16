import jalaali from 'jalaali-js';

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند',
];

export function getTodayJalali() {
  const d = new Date();
  return jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function getTodayString() {
  const j = getTodayJalali();
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}

export function getTodayGregorian() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function jalaliToGregorian(jalaliStr) {
  const parts = jalaliStr.split(/[\/\-]/).map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [jy, jm, jd] = parts;
  const g = jalaali.toGregorian(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
}

export function gregorianToJalali(gStr) {
  if (!gStr) return '';
  const parts = gStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return gStr;
  const [gy, gm, gd] = parts;
  const j = jalaali.toJalaali(gy, gm, gd);
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}

export function getCurrentMonth() {
  const j = getTodayJalali();
  return { year: j.jy, month: j.jm };
}

export function getMonthDateRange(jYear, jMonth) {
  const start = jalaali.toGregorian(jYear, jMonth, 1);
  let end;
  if (jMonth < 12) {
    end = jalaali.toGregorian(jYear, jMonth + 1, 1);
  } else {
    end = jalaali.toGregorian(jYear + 1, 1, 1);
  }
  const startDate = `${start.gy}-${String(start.gm).padStart(2, '0')}-${String(start.gd).padStart(2, '0')}`;
  const endDate = `${end.gy}-${String(end.gm).padStart(2, '0')}-${String(end.gd).padStart(2, '0')}`;
  return { startDate, endDate };
}

export function formatNumber(num) {
  if (num == null) return '۰';
  return Math.round(num).toLocaleString('fa-IR');
}

export function formatCurrency(num) {
  return `${formatNumber(num)} تومان`;
}

export function getMonthName(month) {
  return PERSIAN_MONTHS[month - 1] || '';
}

export function getPreviousMonth(year, month) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function getNextMonth(year, month) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

export function jalaliToDate(jalaliStr) {
  const gStr = jalaliToGregorian(jalaliStr);
  if (!gStr) return null;
  return new Date(gStr + 'T00:00:00');
}

export function getJalaliMonthLength(jYear, jMonth) {
  return jalaali.jalaaliMonthLength(jYear, jMonth);
}
