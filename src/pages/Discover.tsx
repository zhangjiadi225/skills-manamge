import { RotateCw, Download, Trash2, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/app-store";
import { cn } from "../lib/utils";
import { SkillCard, type Skill } from "../components/features/SkillCard";



export default function Discover() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState<string | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);

    const [selectedAgent, setSelectedAgent] = useState<string>("All");
    const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);

    const { installConfig, setSkillUpdates, skillUpdates, updateLastChecked } = useAppStore();

    const loadSkills = () => {
        setLoading(true);
        invoke<Skill[]>("get_local_skills")
            .then((loadedSkills) => {
                setSkills(loadedSkills);
                // Proactively check updates for git-based skills
                handleCheckUpdates(loadedSkills);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const handleCheckUpdates = (skillsToCheck: Skill[], explicit = false) => {
        if (checkingUpdates) return;
        setCheckingUpdates(true);
        if (explicit) setUpdateFeedback("正在检查更新...");

        invoke<{ id: string, remoteHash: string }[]>("check_skill_updates", { skills: skillsToCheck })
            .then((updates) => {
                setSkillUpdates(updates);
                updateLastChecked(skillsToCheck.map(s => s.id));
                if (explicit) {
                    if (updates.length > 0) {
                        setUpdateFeedback(`发现 ${updates.length} 个技能有更新！`);
                    } else {
                        setUpdateFeedback("所有技能已是最新版本");
                    }
                    setTimeout(() => setUpdateFeedback(null), 3000);
                }
            })
            .catch((err) => {
                console.error(err);
                if (explicit) {
                    setUpdateFeedback("检查更新失败: " + err);
                    setTimeout(() => setUpdateFeedback(null), 5000);
                }
            })
            .finally(() => setCheckingUpdates(false));
    };

    useEffect(() => {
        loadSkills();
    }, []);

    // Smart Filtering: Get unique agents from fetched skills
    const availableAgents = Array.from(new Set(skills.map(s => s.agent || "Other"))).sort();

    // Install Input State
    const [installInput, setInstallInput] = useState("");

    const filteredSkills = selectedAgent === "All"
        ? skills
        : skills.filter(s => (s.agent || "Other") === selectedAgent);

    // Group skills by ID for the unified view
    const groupedSkills = Object.values(filteredSkills.reduce((acc, skill) => {
        if (!acc[skill.id]) {
            acc[skill.id] = {
                id: skill.id,
                name: skill.name,
                author: skill.author,
                description: skill.description,
                instances: [] as Skill[]
            };
        }
        acc[skill.id].instances.push(skill);
        return acc;
    }, {} as Record<string, { id: string, name: string, author: string, description: string, instances: Skill[] }>));

    const handleInstall = (source: string) => {
        if (!source) return;
        setInstalling(source);

        // 解析 --skill 参数
        const skillMatch = source.match(/--skill\s+(\S+)/);
        const skillName = skillMatch ? skillMatch[1] : null;

        // 解析 ID (URL 或包名)
        const id = source.replace(/--skill\s+\S+/, "").trim();

        if (!id) {
            alert("请输入有效的安装地址或 ID");
            setInstalling(null);
            return;
        }

        invoke("install_skill", {
            id,
            skill: skillName,
            global: installConfig.installGlobal,
            agents: installConfig.targetAgents,
            autoConfirm: installConfig.autoConfirm,
            installMode: installConfig.installMode
        })
            .then(() => {
                alert("安装成功！");
                setInstalling(null);
                setInstallInput("");
                // 刷新列表
                loadSkills();
            })
            .catch((err) => {
                console.error(err);
                alert("安装失败: " + err);
                setInstalling(null);
            });
    };

    const handleUninstall = (id: string, skillAgents: string[]) => {
        // Determine targets based on view
        let targetAgents: string[] = [];
        let isGlobal = false;

        if (selectedAgent === "All") {
            // In "All" view, delete from ALL agents including global
            targetAgents = skillAgents.filter(a => a !== "global");
            isGlobal = skillAgents.includes("global");
        } else if (selectedAgent === "global") {
            // In global view, it's just global
            isGlobal = true;
            targetAgents = [];
        } else {
            // In specific agent view, delete ONLY from that agent
            targetAgents = [selectedAgent];
            isGlobal = false;
        }

        const agentDisplay = [
            isGlobal ? "global" : null,
            ...targetAgents
        ].filter(Boolean).join(", ");

        if (!confirm(`确定要卸载 "${id}" 从 ${agentDisplay} 吗?`)) {
            return;
        }

        invoke("remove_skills", {
            skillIds: [id],
            global: isGlobal,
            agents: targetAgents,
            removeAll: false,
            autoConfirm: installConfig.autoConfirm
        })
            .then(() => {
                console.log("Uninstalled!");
                // Refresh list
                return loadSkills();
            })
            .catch(err => {
                console.error(err);
                alert("卸载失败: " + err);
            });
    };

    const handleExport = () => {
        // Simple export of all unique skills with their sources
        // Group by ID
        const aggregated = skills.reduce((acc, skill) => {
            if (!acc[skill.id]) {
                acc[skill.id] = { id: skill.id, agents: new Set<string>(), source: skill.source };
            }
            if (skill.agent) acc[skill.id].agents.add(skill.agent);
            return acc;
        }, {} as Record<string, { id: string, agents: Set<string>, source?: string | null }>);

        const data = {
            exportedAt: new Date().toISOString(),
            skills: Object.values(aggregated).map(s => ({
                id: s.id,
                agents: Array.from(s.agents),
                source: s.source
            }))
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `skills-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const toggleSkillSelection = (id: string) => {
        const newSelected = new Set(selectedSkills);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedSkills(newSelected);
    };

    const toggleSelectAll = (ids: string[]) => {
        if (selectedSkills.size === ids.length) {
            setSelectedSkills(new Set());
        } else {
            setSelectedSkills(new Set(ids));
        }
    };

    const handleBatchRemove = () => {
        if (selectedSkills.size === 0) return;

        const skillList = Array.from(selectedSkills);
        if (!confirm(`确定要从当前视图中卸载选中的 ${skillList.length} 个技能吗?`)) {
            return;
        }

        setLoading(true);
        // We will process them one by one or construct a command that handles multiple with mixed global/local
        // For simplicity and safety with the current backend command, we'll loop or handle the most common case.
        // Actually, the new remove_skills command supports a list of IDs.

        // But we need to know if they are global.
        // In "Global" view, they are all global.
        // In "All" view, we'd need to check each one.

        const isGlobal = selectedAgent === "global";
        const targetAgents = selectedAgent === "All" ? [] : [selectedAgent].filter(a => a !== "global");

        invoke("remove_skills", {
            skillIds: skillList,
            global: isGlobal,
            agents: targetAgents,
            removeAll: false,
            autoConfirm: installConfig.autoConfirm
        })
            .then(() => {
                setSelectedSkills(new Set());
                return loadSkills();
            })
            .catch(err => {
                console.error(err);
                alert("批量删除失败: " + err);
            })
            .finally(() => setLoading(false));
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header / Actions Bar */}
            <div className="px-6 py-5 shrink-0 border-b border-slate-50">
                {/* Install Bar */}
                <div className="flex items-center gap-2 mb-6">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={installInput}
                            onChange={(e) => setInstallInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleInstall(installInput)}
                            placeholder="Install skill (e.g. url --skill skill-name)..."
                            className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                        />
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Download size={16} />
                        </div>
                    </div>
                    <button
                        onClick={() => handleInstall(installInput)}
                        disabled={!installInput || installing !== null}
                        className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {installing === installInput ? "Installing..." : "Install"}
                    </button>
                    <button
                        onClick={loadSkills}
                        disabled={loading}
                        className="h-10 w-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
                        title="Refresh List"
                    >
                        <RotateCw size={18} className={cn(loading && !checkingUpdates && "animate-spin")} />
                    </button>
                    <button
                        onClick={() => handleCheckUpdates(skills, true)}
                        disabled={checkingUpdates || skills.length === 0}
                        className={cn(
                            "h-10 px-4 border rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm",
                            checkingUpdates
                                ? "bg-slate-50 border-slate-200 text-slate-400 cursor-wait"
                                : Object.keys(skillUpdates).length > 0
                                    ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-blue-100 hover:text-blue-600"
                        )}
                        title="Check for updates in Git skills"
                    >
                        <Sparkles size={16} className={cn(checkingUpdates && "animate-spin")} />
                        {checkingUpdates ? "Checking..." : Object.keys(skillUpdates).length > 0 ? `发现 ${Object.keys(skillUpdates).length} 个更新` : "检查更新"}
                    </button>
                    {updateFeedback && (
                        <div className="absolute top-20 right-8 bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg border border-slate-700 animate-in slide-in-from-right-4 duration-300 z-50 flex items-center gap-2">
                            <Sparkles size={14} className="text-blue-400" />
                            {updateFeedback}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-slate-800">已安装技能</h2>
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                            {groupedSkills.length}
                        </span>
                    </div>
                    {/* Right Actions */}
                    <div className="flex items-center gap-3">
                        {selectedSkills.size > 0 && (
                            <button
                                onClick={handleBatchRemove}
                                className="h-9 px-4 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-all flex items-center gap-2 shadow-sm"
                            >
                                <Trash2 size={14} />
                                批量卸载 ({selectedSkills.size})
                            </button>
                        )}
                        <button
                            onClick={handleExport}
                            className="h-9 px-4 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:border-blue-200 hover:text-blue-600 transition-all flex items-center gap-2 shadow-sm"
                        >
                            <Download size={14} />
                            批量导出
                        </button>
                    </div>
                </div>

                {/* Smart Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button
                        onClick={() => setSelectedAgent("All")}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap border",
                            selectedAgent === "All"
                                ? "bg-slate-800 text-white border-slate-800 shadow-md"
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        )}
                    >
                        全部 (All)
                    </button>
                    {availableAgents.map(agent => (
                        <button
                            key={agent}
                            onClick={() => setSelectedAgent(agent)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap border flex items-center gap-1.5 capitalize",
                                selectedAgent === agent
                                    ? "bg-white text-blue-600 border-blue-200 shadow-sm"
                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                            )}
                        >
                            <span className={cn("w-1.5 h-1.5 rounded-full", selectedAgent === agent ? "bg-blue-500" : "bg-slate-300")} />
                            {agent}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table Header */}
            <div className="px-4 shrink-0">
                <div className="bg-slate-50/80 rounded-t-xl border-x border-t border-slate-100 px-4 py-3 flex items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div className="w-12 flex justify-center shrink-0">
                        <input
                            type="checkbox"
                            checked={groupedSkills.length > 0 && selectedSkills.size === groupedSkills.length}
                            onChange={() => toggleSelectAll(groupedSkills.map(g => g.id))}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                    </div>
                    <div className="w-16 flex justify-center shrink-0">ICON</div>
                    <div className="w-[40%] shrink-0 pr-4">技能名称 / ID</div>
                    <div className="flex-1 shrink-0 pr-4">已安装 Agent</div>
                    <div className="w-[100px] text-right pr-4">操作</div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
                <div className="bg-white border-x border-b border-slate-100 rounded-b-xl overflow-hidden divide-y divide-slate-100 shadow-sm">
                    {groupedSkills.map((group) => (
                        <SkillCard
                            key={group.id}
                            skillGroup={group}
                            onInstall={handleInstall}
                            onUninstall={handleUninstall}
                            onRefresh={loadSkills}
                            isInstalling={installing === group.id}
                            onSelect={toggleSkillSelection}
                            isSelected={selectedSkills.has(group.id)}
                        />
                    ))}
                </div>
            </div>

            {/* Footer / Pagination */}
            <div className="shrink-0 py-4 px-8 flex items-center justify-between border-t border-slate-100/50">
                <span className="text-xs font-bold text-slate-400">
                    共 {groupedSkills.length} 条技能 (合并视图)
                </span>
                <div className="flex items-center gap-2">
                    {/* Pagination removed as it's not implemented yet */}
                </div>
            </div>
        </div>
    );
}
