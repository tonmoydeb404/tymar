import { appPaths } from "@/config/paths-config";
import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect(appPaths.settingsAccount);
}
