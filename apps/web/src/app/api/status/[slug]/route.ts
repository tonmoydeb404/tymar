import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SLUG_PATTERN = /^[0-9a-f]{32}$/;
const CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=60";

type PublicStatusRow = {
  known: boolean;
  status: string;
  since: string | null;
};

function anonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function getCachedStatus(slug: string) {
  return unstable_cache(
    async (): Promise<PublicStatusRow> => {
      const { data, error } = await anonClient().rpc("get_public_status", {
        p_slug: slug,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { known: false, status: "offline", since: null };
      return {
        known: Boolean(row.known),
        status: String(row.status ?? "offline"),
        since: typeof row.since === "string" ? row.since : null,
      };
    },
    ["public-status", slug],
    { revalidate: 30 },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!SLUG_PATTERN.test(slug)) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  let row: PublicStatusRow;
  try {
    row = await getCachedStatus(slug)();
  } catch {
    return NextResponse.json(
      { error: "upstream_unavailable" },
      { status: 502 },
    );
  }

  if (!row.known) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  return NextResponse.json(
    { status: row.status, since: row.since },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
