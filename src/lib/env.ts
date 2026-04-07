// Environment variable validation — fail fast if required vars are missing

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string): string | undefined {
  return process.env[key] || undefined;
}

export const env = {
  get supabaseUrl() { return required("NEXT_PUBLIC_SUPABASE_URL"); },
  get supabaseAnonKey() { return required("NEXT_PUBLIC_SUPABASE_ANON_KEY"); },
  get supabaseServiceKey() { return optional("SUPABASE_SERVICE_ROLE_KEY"); },
  get footballDataToken() { return optional("FOOTBALL_DATA_TOKEN"); },
  get apiFootballKey() { return optional("API_FOOTBALL_KEY"); },
  get leagueCodes() { return optional("LEAGUE_CODES"); },
};
