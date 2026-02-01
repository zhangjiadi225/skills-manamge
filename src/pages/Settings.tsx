import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SUPPORTED_AGENTS } from "../data/supported-agents";
import { useAppStore } from "../store/app-store";
import { cn } from "../lib/utils";
import { type Skill } from "../components/features/SkillCard";

export default function Settings() {
    const { installConfig, setInstallConfig } = useAppStore();

    const [importText, setImportText] = useState("");
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState("");
    const [copyFeedback, setCopyFeedback] = useState(false);

    const handleExport = async () => {
        try {
            const skills = await invoke<Skill[]>("get_local_skills");

            // Aggregate skills by ID
            const aggregated = skills.reduce((acc, skill) => {
                if (!acc[skill.id]) {
                    acc[skill.id] = {
                        id: skill.id,
                        agents: new Set<string>()
                    };
                }
                if (skill.agent) {
                    acc[skill.id].agents.add(skill.agent);
                }
                return acc;
            }, {} as Record<string, { id: string, agents: Set<string> }>);

            const exportData = {
                exportedAt: new Date().toISOString(),
                skills: Object.values(aggregated).map(s => ({
                    id: s.id,
                    agents: Array.from(s.agents)
                }))
            };

            await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Export failed: " + error);
        }
    };

    const handleImport = async () => {
        if (!importText.trim()) return;

        try {
            const data = JSON.parse(importText);
            if (!Array.isArray(data.skills)) {
                throw new Error("Invalid format: 'skills' array missing");
            }

            setImporting(true);
            const total = data.skills.length;
            let current = 0;

            for (const skill of data.skills) {
                current++;
                setImportProgress(`Installing ${current}/${total}: ${skill.id}`);

                const agents = skill.agents || installConfig.targetAgents;

                try {
                    await invoke("install_skill", {
                        id: skill.id,
                        global: installConfig.installGlobal,
                        agents: agents,
                        autoConfirm: true,
                        installMode: installConfig.installMode
                    });
                } catch (err) {
                    console.error(`Failed to install ${skill.id}:`, err);
                }
            }

            setImportProgress("Batch installation complete!");
            setTimeout(() => {
                setImporting(false);
                setImportProgress("");
                setImportText("");
            }, 2000);

        } catch (error) {
            console.error("Import failed:", error);
            alert("Import failed: " + error);
            setImporting(false);
        }
    };

    const Toggle = ({ title, desc, active, onToggle }: { title: string, desc: string, active: boolean, onToggle: () => void }) => (
        <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0">
            <div>
                <h3 className="text-sm font-bold text-slate-800">{title}</h3>
                <p className="text-xs text-slate-400 mt-1">{desc}</p>
            </div>
            <button
                onClick={onToggle}
                className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    active ? "bg-blue-600" : "bg-slate-200"
                )}
            >
                <div className={cn(
                    "w-4 h-4 bg-white rounded-full shadow-sm absolute top-1 transition-all",
                    active ? "left-7" : "left-1"
                )} />
            </button>
        </div>
    );


    return (
        <div className="flex flex-col h-full bg-white">
            <div className="px-6 py-5 flex items-center justify-between shrink-0 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">设置 (Settings)</h2>
            </div>
            <div className="p-6 overflow-y-auto no-scrollbar">
                <div className="max-w-xl space-y-8">
                    {/* Installation Config Section */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">安装配置 (Installation)</h3>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4">
                            {/* Install Mode Selector */}
                            <div className="flex items-center justify-between py-4 border-b border-slate-100">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Installation Mode</h3>
                                    <p className="text-xs text-slate-400 mt-1">Choose how skills are linked to agents</p>
                                </div>
                                <div className="flex bg-slate-200/50 p-1 rounded-lg">
                                    <button
                                        onClick={() => setInstallConfig({ installMode: 'symlink' })}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                                            installConfig.installMode === 'symlink'
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        Symlink
                                    </button>
                                    <button
                                        onClick={() => setInstallConfig({ installMode: 'copy' })}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                                            installConfig.installMode === 'copy'
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>

                            <Toggle
                                title="Global Install"
                                desc="Install skills explicitly to ~/.agents/skills (-g)"
                                active={installConfig.installGlobal}
                                onToggle={() => setInstallConfig({ installGlobal: !installConfig.installGlobal })}
                            />
                            <Toggle
                                title="Auto Confirm"
                                desc="Skip all confirmation prompts during installation (-y)"
                                active={installConfig.autoConfirm}
                                onToggle={() => setInstallConfig({ autoConfirm: !installConfig.autoConfirm })}
                            />
                            <div className="py-4">
                                <div className="mb-3">
                                    <h3 className="text-sm font-bold text-slate-800">Target Agents</h3>
                                    <p className="text-xs text-slate-400 mt-1">Select which agents to install skills to (-a)</p>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-lg p-2 max-h-60 overflow-y-auto grid grid-cols-2 gap-2 no-scrollbar">
                                    {SUPPORTED_AGENTS.map((agent) => {
                                        const isSelected = installConfig.targetAgents.includes(agent.id);
                                        return (
                                            <button
                                                key={agent.id}
                                                onClick={() => {
                                                    const current = installConfig.targetAgents;
                                                    const newAgents = isSelected
                                                        ? current.filter(id => id !== agent.id)
                                                        : [...current, agent.id];
                                                    setInstallConfig({ targetAgents: newAgents });
                                                }}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all border text-left",
                                                    isSelected
                                                        ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                                                        : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-4 h-4 rounded border flex items-center justify-center transition-colors shadow-sm",
                                                    isSelected ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"
                                                )}>
                                                    {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                </div>
                                                <span className="truncate">{agent.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="mt-2 text-right">
                                    <span className="text-xs font-bold text-slate-400">
                                        Selected: {installConfig.targetAgents.length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Batch Operations Section */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">配置管理 (Config & Batch)</h3>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 space-y-6">
                            {/* Export */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800">Export Configuration</h3>
                                        <p className="text-xs text-slate-400">Copy current setup to clipboard for sharing</p>
                                    </div>
                                    <button
                                        onClick={handleExport}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm border",
                                            copyFeedback
                                                ? "bg-green-50 border-green-200 text-green-700"
                                                : "bg-white border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200"
                                        )}
                                    >
                                        {copyFeedback ? "Copied!" : "Export to Clipboard"}
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-slate-200/50 pt-6">
                                <div className="mb-3">
                                    <h3 className="text-sm font-bold text-slate-800">Batch Install / Import</h3>
                                    <p className="text-xs text-slate-400">Paste a configuration JSON to batch install skills</p>
                                </div>
                                <textarea
                                    value={importText}
                                    onChange={(e) => setImportText(e.target.value)}
                                    placeholder='Paste JSON config here... {"skills": [...] }'
                                    className="w-full h-32 p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none mb-3"
                                />
                                <div className="flex items-center justify-end gap-3">
                                    {importing && (
                                        <span className="text-xs font-bold text-blue-600 animate-pulse">
                                            {importProgress}
                                        </span>
                                    )}
                                    <button
                                        onClick={handleImport}
                                        disabled={importing || !importText.trim()}
                                        className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Start Batch Install
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
