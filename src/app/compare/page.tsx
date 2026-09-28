import { AppShell } from "@/components/app-shell";
import CompareTab from "@/components/tabs/compare-tab";

export default function ComparePage() {
  return (
    <AppShell active="compare">
      <CompareTab />
    </AppShell>
  );
}
