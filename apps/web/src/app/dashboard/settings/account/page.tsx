import { SettingsClient } from "../settings-client";

export const metadata = {
  title: "Account · Settings",
};

export default function SettingsAccountPage() {
  return <SettingsClient section="account" />;
}
