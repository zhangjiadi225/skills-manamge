import { create } from 'zustand'

export type View = 'discover' | 'library' | 'settings' | 'global'

interface InstallConfig {
    installGlobal: boolean
    targetAgents: string[]
    autoConfirm: boolean
    installMode: 'symlink' | 'copy' // New config
}

interface AppState {
    currentView: View
    setView: (view: View) => void
    installConfig: InstallConfig
    setInstallConfig: (config: Partial<InstallConfig>) => void
    skillUpdates: Record<string, { remoteHash: string }>
    setSkillUpdates: (updates: { id: string, remoteHash: string }[]) => void
    lastCheckedMap: Record<string, string>
    updateLastChecked: (ids: string[]) => void
}

export const useAppStore = create<AppState>((set) => ({
    currentView: 'discover',
    setView: (view) => set({ currentView: view }),
    installConfig: {
        installGlobal: true,
        targetAgents: ["antigravity"],
        autoConfirm: true,
        installMode: 'symlink' // Default
    },
    setInstallConfig: (config) => set((state) => ({
        installConfig: { ...state.installConfig, ...config }
    })),
    skillUpdates: {},
    setSkillUpdates: (updates) => set({
        skillUpdates: updates.reduce((acc, update) => ({
            ...acc,
            [update.id]: { remoteHash: update.remoteHash }
        }), {})
    }),
    lastCheckedMap: {},
    updateLastChecked: (ids) => set((state) => ({
        lastCheckedMap: {
            ...state.lastCheckedMap,
            ...ids.reduce((acc, id) => ({ ...acc, [id]: new Date().toLocaleTimeString() }), {})
        }
    })),
}))
