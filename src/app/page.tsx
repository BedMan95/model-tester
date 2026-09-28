import { AppShell } from "@/components/app-shell";
import TesterTab from "@/components/tabs/tester-tab";

export default function TesterPage() {
  return (
    <AppShell active="home">
      <TesterTab />
    </AppShell>
  );
}

