import { externalUrls } from "@/config/paths-config";

export const SITE_URL = externalUrls.site;
export const APP_NAME = externalUrls.appName;
export const REPOSITORY_URL = externalUrls.repository;

// Primary site navigation. Route-based so every page is reachable from the
// header on both the homepage and sub-pages (PageShell).
export const primaryNav = [
  { label: "Changelog", href: "/changelog" },
  { label: "Download", href: "/download" },
] as const;

// Which mock view the hero screenshot shows.
export const heroScreenshot = "timer" as const;

export const capabilities = [
  {
    title: "Start with one click",
    description:
      "Begin a work session straight from the system tray — no forms, no start screen, no tab to keep open.",
    icon: "timer",
  },
  {
    title: "Projects and tasks",
    description:
      "Group every entry under a project and task, so each hour lands in the right bucket automatically.",
    icon: "folder",
  },
  {
    title: "Breaks that count correctly",
    description:
      "Step away without guessing. Breaks are tracked separately from focus time and folded back into your day.",
    icon: "coffee",
  },
  {
    title: "Local-first, synced when you want",
    description:
      "Session state and settings live on your device. Sign in to sync projects, tasks, and history.",
    icon: "shield",
  },
] as const;

export const features = [
  {
    id: "one-click-tracking",
    title: "Tracking that starts before you think about it",
    description:
      "Tymar lives in your system tray. Pick a task, click start, and get on with your work — the timer keeps running even when the window is closed, and the tray readout shows elapsed time at a glance.",
    visualTitle: "Live session view",
    visualDescription: "Screenshot of the live session view with elapsed time and break controls.",
    visualView: "timer",
    tone: "rose",
    span: "wide",
  },
  {
    id: "projects-and-tasks",
    title: "Every hour in the right bucket",
    description:
      "Organize work into projects and tasks, then switch context in one click without losing the running session.",
    visualTitle: "Projects and tasks",
    visualDescription: "Screenshot of the project and task pickers.",
    visualView: "projects",
    tone: "violet",
    span: "narrow",
  },
  {
    id: "history-that-adds-up",
    title: "Your day, accounted for",
    description:
      "Every session — work and breaks — lands in a searchable history with edit support and a dashboard that rolls your time up by day, project, and task. No more reconstructing the week from memory at 6pm on Friday.",
    visualTitle: "History and dashboard",
    visualDescription: "Screenshot of the history list and time dashboard.",
    visualView: "history",
    tone: "blue",
    span: "full",
  },
] as const;

export const workflow = [
  {
    title: "Pick a task",
    description:
      "Choose the project and task you're working on from the tray menu or the command palette.",
  },
  {
    title: "Work — breaks included",
    description:
      "Start the timer and focus. Take a break whenever you need one; Tymar keeps the two apart.",
  },
  {
    title: "See where the day went",
    description:
      "Stop the session and it's already in your history, rolled up by project, task, and day.",
  },
] as const;

export const faqItems = [
  {
    question: "What is Tymar?",
    answer:
      "Tymar is a minimal time tracking app for people who do focused work. It lives in your system tray, tracks work and break sessions, and keeps a searchable history — without dashboards you have to babysit.",
  },
  {
    question: "Which platforms are supported?",
    answer:
      "macOS (Apple Silicon), Windows (x64), and Linux (deb, x86_64). Install with the one-line script on the download page or grab a binary from GitHub Releases.",
  },
  {
    question: "Is Tymar free?",
    answer:
      "Yes. Tymar is free and open source under the MIT License — no subscriptions, no feature locks, no ads.",
  },
  {
    question: "Where does my data live?",
    answer:
      "Session state and settings stay on your device in a local SQLite database. When you sign in, your projects, tasks, and time entries sync to your account so the desktop app and web dashboard stay in step. The full source is on GitHub, so you can verify all of it.",
  },
] as const;

export const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "Changelog", href: "/changelog" },
      { label: "Download", href: "/download" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Support", href: "/support" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: REPOSITORY_URL, external: true },
      {
        label: "Releases",
        href: externalUrls.download,
        external: true,
      },
      {
        label: "MIT License",
        href: `${REPOSITORY_URL}/blob/main/LICENSE`,
        external: true,
      },
    ],
  },
] as const;
