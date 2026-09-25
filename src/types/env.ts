export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;

  TEAM_DOMAIN: string;
  POLICY_AUD: string;
}
