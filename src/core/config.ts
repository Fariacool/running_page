/**
 * 配置从根目录 config.yml 加载，由 Vite 在构建时转换。
 * 直接编辑 config.yml 即可，无需改动此文件。
 */
import rawConfig from '@config';
import type { Locale } from './i18n';
import { normalizeWeekStart, type WeekStart } from '../utils/week';

export interface GoalConfig {
  yearly: number;
  monthly: number;
  weekly: number;
  /** 'distance' (km) | 'time' (minutes) */
  unit: 'distance' | 'time';
}

interface AppConfig {
  locale: Locale;
  theme: 'light' | 'dark' | 'system';
  theme_preset: string;
  week_starts_on?: string | number;
  goals: Record<string, GoalConfig>;
  avatar?: string;
  mapbox_token?: string;
}

const config = rawConfig as unknown as AppConfig;

export const DEFAULT_LOCALE: Locale = config.locale ?? 'zh';
export const DEFAULT_THEME: 'light' | 'dark' | 'system' =
  config.theme ?? 'system';
export const THEME_PRESET: string = config.theme_preset ?? 'default';
export const GOALS: Record<string, GoalConfig> = config.goals ?? {};
export const DEFAULT_GOAL: GoalConfig = GOALS.all ?? {
  yearly: 2000,
  monthly: 150,
  weekly: 35,
  unit: 'distance',
};
export const AVATAR: string = config.avatar ?? '';
export const MAPBOX_TOKEN: string =
  import.meta.env.VITE_MAPBOX_TOKEN || config.mapbox_token || '';

const normalizedWeekStart = normalizeWeekStart(config.week_starts_on);
export const WEEK_STARTS_ON: WeekStart = normalizedWeekStart ?? 1;

if (config.week_starts_on !== undefined && normalizedWeekStart === null) {
  console.warn(
    `[config] Invalid week_starts_on value "${String(
      config.week_starts_on
    )}". Falling back to monday.`
  );
}
