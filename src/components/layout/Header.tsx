import { Component, Settings } from "lucide-react";
import { useAppStore, type View } from "../../store/app-store";
import { cn } from "../../lib/utils";

const NAV_ITEMS: { id: View; label: string; icon?: React.ElementType }[] = [
    { id: "library", label: "本地技能库", icon: Component },
];

export function Header() {
    const { currentView, setView } = useAppStore();

    return (
        <header className="h-20 flex items-center justify-between px-8 bg-[#f8fafc] shrink-0 z-20">
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    skills-manager
                </h1>
            </div>

            <nav className="flex items-center bg-white p-1.5 rounded-full shadow-sm border border-slate-200/50">
                {NAV_ITEMS.map((item) => {
                    const isActive = currentView === item.id || currentView === 'discover'; // Default to library/discover look
                    return (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={cn(
                                "px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 flex items-center gap-2",
                                isActive
                                    ? "bg-slate-900 text-white shadow-md"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            {item.icon && <item.icon size={16} />}
                            {item.label}
                        </button>
                    );
                })}
                <div className="w-px h-6 bg-slate-200 mx-2" />
                <button
                    onClick={() => setView('settings')}
                    className={cn(
                        "px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 flex items-center gap-2",
                        currentView === 'settings' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
                    )}
                >
                    <Settings size={16} />
                    设置
                </button>
            </nav>


        </header>
    );
}
