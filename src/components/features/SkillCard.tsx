import { Download, RefreshCw, Box, Info, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";

// Simplified Skill interface for group instances
export interface Skill {
    id: string;
    name: string;
    description: string;
    author: string;
    stars: number;
    tags: string[];
    installed: boolean;
    version?: string;
    downloads?: number;
    agent?: string;
    is_symlink?: boolean;
}

export interface SkillGroup {
    id: string;
    name: string;
    author: string;
    description: string;
    instances: Skill[];
}

interface SkillCardProps {
    skillGroup: SkillGroup;
    onInstall: (id: string) => void;
    onUninstall: (id: string, agents: string[]) => void;
    isInstalling?: boolean;
}

export function SkillCard({ skillGroup, onInstall, onUninstall, isInstalling }: SkillCardProps) {
    // Sort instances: Symlinks first, then alphabetically by agent
    const sortedInstances = [...skillGroup.instances].sort((a, b) => {
        if (a.is_symlink && !b.is_symlink) return -1;
        if (!a.is_symlink && b.is_symlink) return 1;
        return (a.agent || "").localeCompare(b.agent || "");
    });

    return (
        <div className="group flex items-center p-4 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">

            {/* Icon/Avatar */}
            <div className="w-16 flex justify-center shrink-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 shadow-sm relative overflow-hidden">
                    <Box size={20} />
                </div>
            </div>

            {/* Name & ID Column */}
            <div className="w-[40%] flex flex-col min-w-0 pr-4">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 truncate text-sm">{skillGroup.name}</h3>
                </div>
                <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1 rounded truncate max-w-full">
                        {skillGroup.id}
                    </span>
                    <span className="text-[10px] text-slate-300 font-bold px-1">
                        by {skillGroup.author}
                    </span>
                </div>
            </div>

            {/* Agents Column (Merged) */}
            <div className="flex-1 shrink-0 pr-4 flex flex-wrap gap-1.5">
                {sortedInstances.map((instance, idx) => (
                    <div
                        key={`${instance.agent}-${idx}`}
                        className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold uppercase transition-colors",
                            instance.is_symlink
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                        )}
                        title={instance.is_symlink ? "Symlinked" : "Copied"}
                    >
                        {instance.agent}
                        {instance.is_symlink && <span className="opacity-50 ml-0.5">🔗</span>}
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="w-[100px] flex items-center justify-end gap-1 pl-4 shrink-0">
                <button className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Details">
                    <Info size={16} />
                </button>

                {/* Re-install/Update Button */}
                <button
                    onClick={() => onInstall(skillGroup.id)}
                    disabled={isInstalling}
                    className={cn(
                        "p-1.5 rounded-lg transition-colors ml-2 shadow-sm",
                        isInstalling
                            ? "text-blue-300 bg-blue-50 cursor-wait"
                            : "text-emerald-500 bg-emerald-50 hover:bg-emerald-100"
                    )}
                    title="Re-install / Update"
                >
                    {isInstalling ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                </button>

                {/* Uninstall Button */}
                <button
                    onClick={() => {
                        // Gather all agents for this skill group
                        const agents = skillGroup.instances.map(s => s.agent).filter(Boolean) as string[];
                        onUninstall(skillGroup.id, agents);
                    }}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                    title="Uninstall"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}
