import { RotateCw, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/app-store";
import { cn } from "../lib/utils";
import { SkillCard, type Skill } from "../components/features/SkillCard";



export default function Discover() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [installing, setInstalling] = useState<string | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);

    const { installConfig } = useAppStore();

    const [selectedAgent, setSelectedAgent] = useState<string>("All");

    useEffect(() => {
        invoke<Skill[]>("get_local_skills")
            .then(setSkills)
            .catch(console.error);
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

        invoke("install_skill", {
            id: source,
            global: installConfig.installGlobal,
            agents: installConfig.targetAgents,
            autoConfirm: installConfig.autoConfirm,
            installMode: installConfig.installMode
        })
            .then(() => {
                console.log("Installed!");
                setInstalling(null);
                setInstallInput("");
                // Refresh list
                return invoke<Skill[]>("get_local_skills");
            })
            .then(setSkills)
            .catch((err) => {
                console.error(err);
                setInstalling(null);
            });
    };

    const handleUninstall = (id: string, skillAgents: string[]) => {
        // Determine targets based on view
        let targetAgents: string[] = [];
        if (selectedAgent === "All") {
            // In "All" view, delete from ALL agents that have this skill
            targetAgents = skillAgents;
        } else {
            // In specific agent view, delete ONLY from that agent
            targetAgents = [selectedAgent];
        }

        if (targetAgents.length === 0) return;

        if (!confirm(`Are you sure you want to uninstall "${id}" from ${targetAgents.join(", ")}?`)) {
            return;
        }

        invoke("uninstall_skill", {
            id,
            agents: targetAgents
        })
            .then(() => {
                console.log("Uninstalled!");
                // Refresh list
                return invoke<Skill[]>("get_local_skills");
            })
            .then(setSkills)
            .catch(console.error);
    }

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
                            placeholder="Install skill (ID, URL, or local path)..."
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
                        onClick={() => invoke<Skill[]>("get_local_skills").then(setSkills)}
                        className="h-10 w-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
                    >
                        <RotateCw size={18} />
                    </button>
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
                        <button
                            onClick={() => invoke<Skill[]>("get_local_skills").then(setSkills)}
                            className="h-9 w-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
                        >
                            <RotateCw size={16} />
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
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap border flex items-center gap-1.5",
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
                            isInstalling={installing === group.id}
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
