import { SettingsClient } from "../settings-client";

export const metadata = {
  title: "Public status · Settings",
};

export default function SettingsPublicstatusPage() {
  return <SettingsClient section="public-status" />;
}
