import { LogoutButton } from "@/components/logout-button";
import { Planner } from "@/components/planner";

export default function Home() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Running Planner</h1>
        <LogoutButton />
      </header>
      <Planner />
    </div>
  );
}
