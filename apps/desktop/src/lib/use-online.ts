import { useEffect, useState } from "react";

/** Whether the OS reports a network connection. Offline here only means
 * "definitely no network" — a flaky or captive connection still reads as
 * online and is surfaced by sync errors instead. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}
