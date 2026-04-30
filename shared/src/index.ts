export interface CrimeRecord {
  id: string;
  type: string;
  city: string;
  area: string;
  timestamp: string;
  severity: number;
  link: string;
  is_violent?: boolean;
}

export interface DailyStats {
  date: string;
  total_crimes: number;
  moon_phase: string;
  deviation_score: number;
}

export interface DailyArticle {
  title: string;
  lede: string;
  body: string;
  risk_level: number;
  stats_snapshot: DailyStats;
  published_at: any;
  vibe_tonight?: string;
  context?: string;
  today_moon?: string;
}
