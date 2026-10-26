import { Skeleton } from "@packages/ui/components/skeleton";
import { Toaster } from "@packages/ui/components/sonner";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./context/app-context";
import { DbProvider } from "./context/db/db-context";
import { ModalProvider } from "./context/modal-context";
import { SyncProvider } from "./context/sync-context";
import { TimerProvider } from "./context/timer-context";
import { TabLayout } from "./layouts/tab-layout";
import { LoginScreen } from "./screens/auth/login";
import { HomeScreen } from "./screens/home";
import { SettingsScreen } from "./screens/settings";
import { TimesScreen } from "./screens/times";

function LoadingShell() {
  return (
    <main className="flex h-svh w-full flex-col overflow-hidden bg-background">
      <div className="h-14 shrink-0 border-b border-border" />
      <div className="mx-auto grid w-full max-w-[420px] flex-1 gap-2 overflow-hidden px-3.5 pt-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <div className="h-14 shrink-0 border-t border-border" />
    </main>
  );
}

function ErrorShell({ error }: { error: string }) {
  return (
    <main className="flex h-svh w-full flex-col items-center justify-center gap-2 overflow-hidden px-6 text-center">
      <strong className="text-[0.88rem] text-danger">
        Something went wrong
      </strong>
      <span className="text-[0.76rem] text-muted-foreground">{error}</span>
    </main>
  );
}

function AppRoutes() {
  const { loading, error, auth } = useApp();

  if (loading || auth === null) return <LoadingShell />;
  if (error) return <ErrorShell error={error} />;

  // "unknown" with a configured backend means Appwrite was unreachable at
  // boot — let the user into the shell (stored session may still be valid).
  // "unknown" without config is a broken build: show login's setup message.
  const signedIn =
    auth.status === "active" || (auth.status === "unknown" && auth.configured);
  if (!signedIn) return <LoginScreen />;

  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route index element={<HomeScreen />} />
        <Route path="times" element={<TimesScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SyncProvider>
        <DbProvider>
          <TimerProvider>
            <ModalProvider>
              <HashRouter>
                <AppRoutes />
              </HashRouter>
              <Toaster position="top-right" />
            </ModalProvider>
          </TimerProvider>
        </DbProvider>
      </SyncProvider>
    </AppProvider>
  );
}
