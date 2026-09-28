import { AppShell } from "@/components/app-shell";
import ChatTab from "@/components/tabs/chat-tab";

export default function ChatPage() {
  return (
    <AppShell active="chat">
      <ChatTab />
    </AppShell>
  );
}
