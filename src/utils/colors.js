export const LIGHT_THEME = {
  primary: '#5B7FD3',
  primaryDark: '#4566B0',
  primaryLight: '#E8EEF9',
  accent: '#FF7B7B',
  green: '#34C47C',
  red: '#E85D5D',
  orange: '#F0A030',
  background: '#F2F4F8',
  card: '#FFFFFF',
  text: '#1E293B',
  textLight: '#8494A7',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  shadow: '#94A3B8',
  inputBg: '#F8FAFC',
  success: '#34C47C',
  warning: '#F0A030',
  danger: '#E85D5D',
};

export const DARK_THEME = {
  primary: '#7B9DE8',
  primaryDark: '#5B7FD3',
  primaryLight: '#1E293B',
  accent: '#FF7B7B',
  green: '#4ADE80',
  red: '#F87171',
  orange: '#FBBF24',
  background: '#0F172A',
  card: '#1E293B',
  text: '#F1F5F9',
  textLight: '#94A3B8',
  textSecondary: '#CBD5E1',
  border: '#334155',
  shadow: '#000',
  inputBg: '#334155',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
};

export let COLORS = { ...LIGHT_THEME };

export function setTheme(isDark) {
  const theme = isDark ? DARK_THEME : LIGHT_THEME;
  Object.assign(COLORS, theme);
}

export const CHART_COLORS = [
  '#5B7FD3', '#FF7B7B', '#34C47C', '#F0A030', '#A78BFA',
  '#2DD4BF', '#FB923C', '#60A5FA', '#F87171', '#4ADE80',
];
