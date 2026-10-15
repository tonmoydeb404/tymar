const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing required Supabase URL");
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing required Supabase publishable key");
}

export const envConfig = {
  NODE_ENV: process.env.NODE_ENV,
  IS_DEV: process.env.NODE_ENV === "development",
  IS_PROD: process.env.NODE_ENV === "production",

  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  SUPABASE: {
    URL: SUPABASE_URL,
    PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
  },
};
