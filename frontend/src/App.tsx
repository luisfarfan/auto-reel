import { useState } from "react"
import { Dashboard } from "@/pages/Dashboard"
import { YouTubePage } from "@/pages/YouTube"
import { TwitterPage } from "@/pages/Twitter"
import { TechVideoPage } from "@/pages/TechVideo"
import { CostsPage } from "@/pages/Costs"
import { ConfigPage } from "@/pages/Config"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Video, AtSign, DollarSign, Settings, Film } from "lucide-react"

type Page = "dashboard" | "youtube" | "tech" | "twitter" | "costs" | "config"

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard",   icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "youtube",   label: "YouTube",     icon: <Video className="w-4 h-4" /> },
  { id: "tech",      label: "Tech Videos", icon: <Film className="w-4 h-4" /> },
  { id: "twitter",   label: "Twitter",     icon: <AtSign className="w-4 h-4" /> },
  { id: "costs",     label: "Costs",       icon: <DollarSign className="w-4 h-4" /> },
  { id: "config",    label: "Config",      icon: <Settings className="w-4 h-4" /> },
]

export default function App() {
  const [page, setPage] = useState<Page>("dashboard")

  return (
    <div className="flex min-h-screen">
      <nav className="w-52 shrink-0 border-r border-border flex flex-col py-6 px-3 gap-1">
        <div className="px-3 mb-6">
          <h1 className="text-sm font-bold tracking-tight">MoneyPrinter</h1>
          <p className="text-xs text-muted-foreground">v2</p>
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
              page === n.id
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto">
        {page === "dashboard" && <Dashboard />}
        {page === "youtube"    && <YouTubePage />}
        {page === "tech"       && <TechVideoPage />}
        {page === "twitter"    && <TwitterPage />}
        {page === "costs"      && <CostsPage />}
        {page === "config"     && <ConfigPage />}
      </main>
    </div>
  )
}
