/**
 * Central path configuration for the web site.
 *
 * Single source of truth for every internal route, dynamic path builder,
 * and external URL used across the app. Import from here instead of
 * hardcoding path strings.
 */

// ---------------------------------------------------------------------------
// External URLs
// ---------------------------------------------------------------------------

// @brand:generated-start
export const externalUrls = {
  site: "https://tonmoydeb.com",
  appName: "Tymar",
  slug: "tymar",
  devSlug: "tymar-dev",
  descriptionShort: "Effortless time tracking for focused work.",
  download: "https://github.com/tonmoydeb404/tymar/releases/latest",
  repository: "https://github.com/tonmoydeb404/tymar",
  license: "https://github.com/tonmoydeb404/tymar/blob/main/LICENSE",
} as const;
// @brand:generated-end

// ---------------------------------------------------------------------------
// Internal static paths
// ---------------------------------------------------------------------------

export const sitePaths = {
  home: "/",
  changelog: "/changelog",
  download: "/download",
  support: "/support",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export type SitePath = string;

/** Static (non-dynamic) routes, in declaration order — consumed by sitemap and nav. */
export const staticRoutes: readonly SitePath[] = [
  sitePaths.home,
  sitePaths.changelog,
  sitePaths.download,
  sitePaths.support,
  sitePaths.privacy,
  sitePaths.terms,
];

// ---------------------------------------------------------------------------
// Full URLs (static path joined with the canonical site origin)
// ---------------------------------------------------------------------------

export const siteUrl = (path: string = sitePaths.home): string =>
  `${externalUrls.site}${path}`;

// ---------------------------------------------------------------------------
// Authenticated product routes (nested under /dashboard)
// ---------------------------------------------------------------------------

export const appPaths = {
  login: "/login",
  callback: "/auth/callback",
  dashboard: "/dashboard",
  projects: "/dashboard/projects",
  tasks: "/dashboard/tasks",
  time: "/dashboard/time",
  export: "/dashboard/export",
  settings: "/dashboard/settings",
  settingsAccount: "/dashboard/settings/account",
  settingsWorkspaces: "/dashboard/settings/workspaces",
  settingsPublicStatus: "/dashboard/settings/public-status",
} as const;
