
import { useState } from 'react'
import {
    LayoutDashboard,
    LogOut,
    Menu,
    Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface AdminLayoutProps {
    children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const handleSignOut = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) {
            toast.error('Error signing out')
        }
    }

    return (
        <div className="min-h-screen bg-slate-100 flex">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-950 text-slate-100 border-r border-slate-800 transform transition-transform duration-200 ease-in-out lg:transform-none flex flex-col",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">ChefVoice</p>
                        <span className="text-lg font-semibold text-white">Business Ops</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <p className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">Live</p>
                    <button
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg bg-cyan-500/15 text-cyan-200 border border-cyan-500/30"
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                    </button>

                    <p className="px-3 pt-5 pb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">Planned Modules</p>
                    <div className="space-y-2">
                        {['Customer Growth', 'Billing Intelligence', 'Audit Timeline', 'Account Controls'].map((label) => (
                            <div
                                key={label}
                                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm rounded-lg text-slate-400 bg-slate-900/60 border border-slate-800"
                            >
                                <span>{label}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">Soon</span>
                            </div>
                        ))}
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="mb-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
                        <div className="mb-1 flex items-center gap-2 text-slate-300">
                            <Shield className="w-3.5 h-3.5" />
                            Secure Access
                        </div>
                        Data shown respects Supabase RLS for the logged-in admin user.
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Mobile Header */}
                <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 justify-between">
                    <span className="font-semibold text-slate-900">Operations Dashboard</span>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
