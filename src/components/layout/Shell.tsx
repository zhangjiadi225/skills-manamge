import { Header } from "./Header";

interface ShellProps {
    children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
    return (
        <div className="flex flex-col h-screen w-full bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
            <Header />
            <main className="flex-1 relative overflow-hidden flex flex-col px-8 pb-8 pt-2">
                <div className="flex-1 bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
                    {children}
                </div>
            </main>
        </div>
    );
}
