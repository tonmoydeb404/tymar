import { externalUrls } from "@/config/paths-config";

export type DocPage = {
  slug: string;
  title: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  body: { heading: string; text: string }[];
  shortcuts?: { keys: string; action: string }[];
};

export const getDoc = (slug: string) => docs.find((d) => d.slug === slug);

export const docs: DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    h1: "Getting started",
    metaTitle: "Getting Started — Tymar Docs",
    metaDescription:
      "Install Tymar, sign in, and finish your first tracked work session in a few minutes.",
    intro:
      "From download to your first tracked session in about five minutes.",
    body: [
      {
        heading: "1. Install Tymar",
        text: "Download a build from GitHub Releases, or run the one-line installer for your platform: curl on macOS and Linux, irm on Windows. On macOS the app installs to /Applications via Homebrew; on Linux the .deb is installed with dpkg; on Windows the installer runs silently. After the first launch, Tymar lives in your system tray.",
      },
      {
        heading: "2. Sign in and add your work",
        text: "Tymar opens with a sign-in screen — use the Google button and approve in your browser; you'll land back in the app automatically. Then create a project (for example \"Client Website\") and a task under it (\"Homepage redesign\"). Projects and tasks sync to your account so the desktop app and web dashboard share the same data.",
      },
      {
        heading: "3. Track your first session",
        text: "Right-click the tray icon, pick your task, and press Start. The tray readout shows elapsed time while you work. Need a coffee? Choose Take a break — the break is recorded separately and your focus time stays clean. Press Stop when you're done; the session is already in your history.",
      },
      {
        heading: "4. Review and edit",
        text: "Open the History tab to search past sessions, fix a task, or adjust times by hand. The web dashboard rolls everything up by day, project, and task.",
      },
    ],
    shortcuts: [
      { keys: "⌘K / Ctrl K", action: "Open the command palette" },
      { keys: "D", action: "Toggle dark/light theme" },
    ],
  },
  {
    slug: "concepts",
    title: "Concepts",
    h1: "Core concepts",
    metaTitle: "Concepts — Tymar Docs",
    metaDescription:
      "The mental model behind Tymar: sessions, breaks, projects and tasks, and where your data lives.",
    intro:
      "Three ideas cover everything Tymar does: sessions, projects and tasks, and where your data lives.",
    body: [
      {
        heading: "Sessions and breaks",
        text: "A session is one continuous stretch of tracked work. Starting a new session stops the previous one, so you never double-book time. A break is a special kind of session: it pauses your focus time, and both sides of the interruption are recorded so your day stays honest.",
      },
      {
        heading: "Projects and tasks",
        text: "Projects are the containers — a client, a product, a job hunt. Tasks are the concrete things you do inside them. Every session is attributed to a task, which is what makes the dashboard rollups (by project, by task, by day) meaningful. Switching task mid-session switches what the running time is attributed to.",
      },
      {
        heading: "Where data lives",
        text: "Your settings and the active session snapshot are stored locally on your device in a SQLite database. Your projects, tasks, profile, and finished time entries sync to your account, which is what keeps the desktop app and the web dashboard in step. Sign out on one device and your data is still there when you sign back in.",
      },
    ],
  },
  {
    slug: "public-status",
    title: "Public status",
    h1: "Public status API",
    metaTitle: "Public Status API — Tymar Docs",
    metaDescription:
      "Share your live working status on any website with a private, renewable link that exposes nothing but your status.",
    intro:
      "Show visitors whether you're working, on a break, or offline — with a private link that exposes nothing else.",
    body: [
      {
        heading: "Enable your link",
        text: "Open the web dashboard, go to Settings → Public status, and generate your link. The link contains a random, unguessable slug and exposes only your current status and when the current session started — never your tasks, projects, or history. Pause it anytime with the toggle, and generating a new link immediately invalidates the old one.",
      },
      {
        heading: "The endpoint",
        text: `GET ${externalUrls.site}/api/status/your-slug returns JSON like {"status":"working","since":"2026-10-15T09:12:00Z"}. Status is one of working, on_break, or offline; since is the start time of the current session (null when offline). Unknown or paused links return 404. Responses are cached for about 30 seconds, so poll no faster than once a minute.`,
      },
      {
        heading: "Embed on your site",
        text: "Fetch the URL from your portfolio with JavaScript and render a small colored dot: green for working, amber for on break, gray for offline. Polling once a minute is plenty — responses are served from cache, so it is effectively free. Use since to show extras like \"since 9:41 AM\" or a running duration, computed locally in your own code.",
      },
      {
        heading: "Accuracy",
        text: "Status comes straight from your running timer, so it reflects what the desktop app is actually doing. Changes land within a few minutes. If the app quits or your laptop sleeps mid-session, the link automatically reports offline after about 15 minutes without a sync.",
      },
    ],
  },
];
