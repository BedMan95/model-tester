import { AppShell } from "@/components/app-shell";
import HistoryTab from "@/components/tabs/history-tab";

export default function HistoryPage() {
  return (
    <AppShell active="history">
      <HistoryTab />
    </AppShell>
  );
}
