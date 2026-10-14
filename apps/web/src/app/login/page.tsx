import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16 w-full min-h-screen">
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading sign-in…</p>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
