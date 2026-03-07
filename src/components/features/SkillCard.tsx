import { RefreshCw, Box, Trash2, Settings2, Sparkles, History, Github } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { ConfigModal } from "./ConfigModal";
import { useAppStore } from "../../store/app-store";
import { invoke } from "@tauri-apps/api/core";

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
    source?: string | null;
    has_update?: boolean;
    local_hash?: string | null;
    remote_hash?: string | null;
    last_updated?: string | null;
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
    onRefresh: () => void;
    isInstalling?: boolean;
    onSelect?: (id: string) => void;
    isSelected?: boolean;
}

export function SkillCard({ skillGroup, onInstall, onUninstall, onRefresh, isInstalling, onSelect, isSelected }: SkillCardProps) {
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const { skillUpdates, setSkillUpdates, lastCheckedMap } = useAppStore();

    const updateInfo = skillUpdates[skillGroup.id];
    const lastChecked = lastCheckedMap[skillGroup.id];
    const hasUpdate = !!updateInfo;

    const handleUpdate = async () => {
        if (!hasUpdate) {
            onInstall(skillGroup.id);
            return;
        }

        setIsUpdating(true);
        try {
            await invoke("update_skill_repo", {
                id: skillGroup.id,
                agent: skillGroup.instances[0]?.agent || "global"
            });
            // Success! Clear update state for this skill
            const newUpdates = { ...skillUpdates };
            delete newUpdates[skillGroup.id];

            // Map the remaining object back to the array format setSkillUpdates expects
            const updatesArray = Object.entries(newUpdates).map(([id, info]) => ({
                id,
                remoteHash: info.remoteHash
            }));

            setSkillUpdates(updatesArray);
            onRefresh();
            alert("更新成功！");
        } catch (err) {
            alert("更新失败: " + err);
        } finally {
            setIsUpdating(false);
        }
    };

    // Sort instances: Symlinks first, then alphabetically by agent
    const sortedInstances = [...skillGroup.instances].sort((a, b) => {
        if (a.is_symlink && !b.is_symlink) return -1;
        if (!a.is_symlink && b.is_symlink) return 1;
        return (a.agent || "").localeCompare(b.agent || "");
    });

    return (
        <div className={cn(
            "group flex items-center p-4 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors",
            isSelected && "bg-blue-50/50"
        )}>
            {/* Checkbox */}
            <div className="w-12 flex justify-center shrink-0">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect?.(skillGroup.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
            </div>

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
                    {hasUpdate && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full animate-bounce-subtle">
                            <Sparkles size={10} />
                            更新: {updateInfo.remoteHash}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <History size={11} />
                        <span>{skillGroup.instances[0]?.last_updated || "未知日期"}</span>
                        {lastChecked && (
                            <>
                                <span className="mx-1 opacity-30">·</span>
                                <span className="text-blue-500/70 font-medium">已检查 {lastChecked}</span>
                            </>
                        )}
                    </div>
                    {skillGroup.instances[0]?.local_hash && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                            <Github size={11} />
                            <span>{skillGroup.instances[0]?.local_hash}</span>
                        </div>
                    )}
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
                <button
                    onClick={() => setIsConfigOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Configure Skill"
                >
                    <Settings2 size={16} />
                </button>

                {/* Re-install/Update Button */}
                <button
                    onClick={handleUpdate}
                    disabled={isInstalling || isUpdating}
                    className={cn(
                        "p-1.5 rounded-lg transition-colors ml-2 shadow-sm",
                        (isInstalling || isUpdating)
                            ? "text-blue-300 bg-blue-50 cursor-wait"
                            : hasUpdate
                                ? "text-white bg-blue-600 hover:bg-blue-700 animate-pulse"
                                : "text-emerald-500 bg-emerald-50 hover:bg-emerald-100"
                    )}
                    title={hasUpdate ? "一键自动更新" : "重新安装 / 刷新"}
                >
                    {(isInstalling || isUpdating) ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                </button>

                {/* Uninstall Button */}
                <button
                    onClick={() => onUninstall(skillGroup.id, sortedInstances.map(i => i.agent).filter(Boolean) as string[])}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                    title="Uninstall"
                >
                    <Trash2 size={16} />
                </button>

                {isConfigOpen && (
                    <ConfigModal
                        isOpen={isConfigOpen}
                        onClose={() => setIsConfigOpen(false)}
                        skillId={skillGroup.id}
                        agent={skillGroup.instances[0]?.agent || "global"}
                    />
                )}
            </div>
        </div>
    );
}
