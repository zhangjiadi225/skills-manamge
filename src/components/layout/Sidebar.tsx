import { Compass, Library, Settings } from "lucide-react";
import { useAppStore, type View } from "../../store/app-store";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";

const NAV_ITEMS: { id: View; label: string; icon: React.FC<any> }[] = [
    { id: "discover", label: "Discover", icon: Compass },
    { id: "library", label: "Library", icon: Library },
    { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
    const { currentView, setView } = useAppStore();

    return (
        <aside className="w-64 border-r border-white/5 bg-neutral-950/50 backdrop-blur-xl flex flex-col p-4 gap-2">
            <div className="h-12 flex items-center px-4 mb-8">
                <div className="size-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    <div className="size-3 bg-white rounded-full bg-opacity-20" />
                </div>
                <span className="ml-3 font-semibold text-lg tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    Cortex
                </span>
            </div>

            <nav className="flex-1 flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={cn(
                                "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group",
                                isActive
                                    ? "text-blue-100 bg-blue-500/10 shadow-[inner_0_0_10px_rgba(59,130,246,0.1)]"
                                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="active-indicator"
                                    className="absolute left-0 w-1 h-6 rounded-r-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                />
                            )}
                            <item.icon
                                className={cn(
                                    "size-5 transition-transform duration-300",
                                    isActive ? "scale-110 text-blue-400" : "group-hover:scale-110"
                                )}
                            />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            <div className="mt-auto px-4 py-4 text-xs text-neutral-600 border-t border-white/5 pt-6">
                <p>v0.1.0 • Alpha</p>
                <p className="mt-1">Stable Channel</p>
            </div>
        </aside>
    );
}
