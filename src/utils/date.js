import jalaali from 'jalaali-js';

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند',
];

const PERSIAN_WEEKDAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه',
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

export function getTodayFullString() {
  const d = new Date();
  const j = getTodayJalali();
  const weekday = PERSIAN_WEEKDAYS[d.getDay()];
  return `${weekday} ${j.jd} ${PERSIAN_MONTHS[j.jm - 1]} ${j.jy}`;
}

export function jalaliToGregorian(jalaliStr) {
  if (!jalaliStr) return null;
  const parts = jalaliStr.split(/[\/\-]/).map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [jy, jm, jd] = parts;
  try {
    const g = jalaali.toGregorian(jy, jm, jd);
    return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
  } catch (e) {
    return null;
  }
}

export function gregorianToJalali(gStr) {
  if (!gStr) return '';
  const parts = gStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return gStr;
  const [gy, gm, gd] = parts;
  try {
    const j = jalaali.toJalaali(gy, gm, gd);
    return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
  } catch (e) {
    return gStr;
  }
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

export function getYearOptions() {
  const j = getTodayJalali();
  const years = [];
  for (let y = j.jy - 2; y <= j.jy + 1; y++) {
    years.push(y);
  }
  return years;
}

export function getMonthOptions() {
  return PERSIAN_MONTHS.map((name, i) => ({ value: i + 1, label: name }));
}

export function getDayOptions(jYear, jMonth) {
  const len = jalaali.jalaaliMonthLength(jYear, jMonth);
  const days = [];
  for (let d = 1; d <= len; d++) {
    days.push(d);
  }
  return days;
}
