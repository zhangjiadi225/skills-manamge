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
}))
