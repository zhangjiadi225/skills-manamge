import { useState, useEffect } from "react";
import { X, Save, AlertCircle, BookOpen, Info } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../../lib/utils";

interface ConfigModalProps {
    skillId: string;
    agent: string;
    isOpen: boolean;
    onClose: () => void;
}

interface SkillConfigResponse {
    current_config: string;
    documentation: string | null;
}

export function ConfigModal({ skillId, agent, isOpen, onClose }: ConfigModalProps) {
    const [config, setConfig] = useState("");
    const [documentation, setDocumentation] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showDoc, setShowDoc] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setError(null);
            invoke<SkillConfigResponse>("get_skill_config", { id: skillId, agent })
                .then((res) => {
                    setConfig(res.current_config);
                    setDocumentation(res.documentation);
                    // If no documentation is found, maybe hide the doc area by default
                    if (!res.documentation) setShowDoc(false);
                    else setShowDoc(true);
                })
                .catch(err => setError(err.toString()))
                .finally(() => setLoading(false));
        }
    }, [isOpen, skillId, agent]);

    const handleSave = () => {
        try {
            // Validate JSON
            JSON.parse(config);

            setLoading(true);
            setError(null);
            invoke("save_skill_config", { id: skillId, agent, config })
                .then(() => {
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 2000);
                })
                .catch(err => setError(err.toString()))
                .finally(() => setLoading(false));
        } catch (e) {
            setError("Invalid JSON format");
        }
    };

    if (!isOpen) return null;

    const noContent = !documentation && (config === "{}" || !config);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={cn(
                "bg-white w-full rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden transition-all duration-300",
                showDoc && documentation ? "max-w-4xl" : "max-w-xl"
            )}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">技能配置 (Skill Config)</h2>
                            <p className="text-xs text-slate-400 mt-0.5 font-mono">
                                {skillId} <span className="opacity-50 mx-1">/</span> {agent}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {documentation && (
                            <button
                                onClick={() => setShowDoc(!showDoc)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                                    showDoc ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <Info size={14} />
                                {showDoc ? "隐藏文档" : "说明文档"}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Documentation Side (Optional) */}
                    {showDoc && documentation && (
                        <div className="w-1/2 border-r border-slate-100 bg-slate-50/30 overflow-y-auto p-6 animate-in slide-in-from-left-4 duration-300">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <BookOpen size={14} />
                                SKILL.md 说明文档
                            </h3>
                            <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                                {documentation}
                            </div>
                        </div>
                    )}

                    {/* Editor Side */}
                    <div className={cn("flex-1 p-6 flex flex-col", (showDoc && documentation) ? "w-1/2" : "w-full")}>
                        {noContent ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm mb-4">
                                    <AlertCircle size={24} />
                                </div>
                                <h4 className="text-sm font-bold text-slate-800 mb-1">无需配置</h4>
                                <p className="text-xs text-slate-400 max-w-[200px]">
                                    该技能目前暂无任何可配置的参数说明或初始配置。
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                    <span>skill.config.json</span>
                                    {error === "Invalid JSON format" && <span className="text-red-500 font-bold animate-pulse">格式错误</span>}
                                </label>
                                <textarea
                                    value={config}
                                    onChange={(e) => setConfig(e.target.value)}
                                    spellCheck={false}
                                    className={cn(
                                        "flex-1 p-4 bg-slate-50 border rounded-xl font-mono text-sm text-slate-700 transition-all focus:outline-none focus:ring-4 focus:bg-white resize-none",
                                        error ? "border-red-200 focus:ring-red-100" : "border-slate-200 focus:ring-blue-100"
                                    )}
                                    placeholder='{ "apiKey": "...", "preferences": { ... } }'
                                />
                            </div>
                        )}

                        {error && error !== "Invalid JSON format" && (
                            <div className="mt-4 flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                                <AlertCircle size={16} className="shrink-0" />
                                <span className="text-xs font-bold truncate">{error}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <p className="text-[10px] text-slate-400">
                        提示: 编辑后请务必点击保存以生效
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || noContent}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-md",
                                saveSuccess
                                    ? "bg-emerald-500 text-white"
                                    : (loading || noContent) ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
                            )}
                        >
                            {loading ? (
                                <span className="animate-pulse">保存中...</span>
                            ) : saveSuccess ? (
                                <>
                                    <Save size={16} />
                                    已保存
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    保存配置
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
