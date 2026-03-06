import { useState } from 'react'
import { Users, Plus, Edit2, Trash2 } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useStaff, useCreateStaff, useUpdateStaff, useDeleteStaff } from '@/hooks/queries/useStaff'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function StaffSettings() {
    const { currentSite } = useAppStore()

    // React Query Hooks
    const { data: staffList = [], isLoading: loading } = useStaff(currentSite?.id)
    const createStaff = useCreateStaff()
    const updateStaff = useUpdateStaff()
    const deleteStaff = useDeleteStaff()

    // Add New Staff State
    const [newStaffName, setNewStaffName] = useState('')
    const [newStaffRole, setNewStaffRole] = useState<'staff' | 'chef' | 'manager'>('staff')
    const [newStaffCode, setNewStaffCode] = useState('')

    // Edit Staff State
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editRole, setEditRole] = useState<'staff' | 'chef' | 'manager'>('staff')
    const [editCode, setEditCode] = useState('')

    // Calculate next available code
    const nextStaffCode = (() => {
        if (!staffList.length) return '1'
        const codes = staffList
            .map(s => parseInt(s.staff_code || '0'))
            .filter(n => !isNaN(n) && n > 0)
        return codes.length > 0 ? String(Math.max(...codes) + 1) : '1'
    })()

    // Auto-fill code when list loads
    const [hasInitializedCode, setHasInitializedCode] = useState(false)
    if (!loading && staffList.length > 0 && !newStaffCode && !hasInitializedCode) {
        setNewStaffCode(nextStaffCode)
        setHasInitializedCode(true)
    }

    const handleAddStaff = () => {
        if (!currentSite?.id) return
        if (!newStaffName.trim()) {
            toast.error('Name is required')
            return
        }
        if (!newStaffCode.trim()) {
            toast.error('Staff code is required')
            return
        }

        createStaff.mutate({
            site_id: currentSite.id,
            name: newStaffName.trim(),
            role: newStaffRole,
            pin_hash: newStaffCode.trim(), // Keep pin_hash for auth compatibility
            staff_code: newStaffCode.trim(), // Store readable code
            active: true
        }, {
            onSuccess: () => {
                setNewStaffName('')
                // Reset to next code + 1 (heuristic until refresh)
                setNewStaffCode(String(parseInt(newStaffCode) + 1))
                setNewStaffRole('staff')
            },
            onError: () => toast.error('Failed to add staff member')
        })
    }

    const handleUpdateStaff = (id: string) => {
        if (!editName.trim()) {
            toast.error('Name is required')
            return
        }

        updateStaff.mutate({
            id,
            updates: {
                name: editName.trim(),
                role: editRole,
                pin_hash: editCode.trim() || undefined,
                staff_code: editCode.trim() || undefined
            }
        }, {
            onSuccess: () => setEditingStaffId(null),
            onError: () => toast.error('Failed to update staff member')
        })
    }

    const handleDeleteStaff = (id: string) => {
        if (!confirm('Are you sure you want to remove this staff member?')) return
        deleteStaff.mutate(id, {
            onError: () => toast.error('Failed to remove staff member')
        })
    }

    return (
        <div className="space-y-6 animate-slide-in">
            <div className="card-stunning p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-500">
                        <Users className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground/90">Staff Management</h2>
                        <p className="text-foreground/60">Manage team members and access codes.</p>
                    </div>
                </div>

                {/* Add New Staff Form */}
                <div className="bg-theme-ghost p-4 rounded-xl border border-theme-primary/50 mb-8">
                    <h3 className="text-sm font-bold uppercase text-foreground/70 mb-3">Add New Staff</h3>
                    <div className="flex flex-col md:flex-row gap-3">
                        <input
                            value={newStaffName}
                            onChange={e => setNewStaffName(e.target.value)}
                            placeholder="Name (e.g. John Doe)"
                            className="input-stunning flex-1 w-full"
                        />
                        <select
                            value={newStaffRole}
                            onChange={e => setNewStaffRole(e.target.value as any)}
                            className="input-stunning w-full md:w-32 capitalize"
                        >
                            <option value="staff">Staff</option>
                            <option value="chef">Chef</option>
                            <option value="manager">Manager</option>
                        </select>
                        <div className="relative">
                            <input
                                value={newStaffCode}
                                onChange={e => setNewStaffCode(e.target.value)}
                                placeholder="Code"
                                className="input-stunning w-full md:w-24 font-mono text-center"
                                inputMode="numeric"
                            />
                        </div>
                        <button
                            onClick={handleAddStaff}
                            className="btn-stunning btn-primary h-[46px] px-6"
                        >
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>
                </div>

                {/* Staff List */}
                <div className="space-y-3">
                    {loading && <p className="text-theme-secondary text-center py-4">Loading staff...</p>}
                    {!loading && staffList.length === 0 && (
                        <p className="text-theme-secondary text-center py-8">No staff members found.</p>
                    )}

                    {staffList.map(staff => (
                        <div key={staff.id} className="p-4 bg-theme-ghost rounded-xl border border-theme-primary hover:border-theme-secondary transition-colors text-sm">
                            {editingStaffId === staff.id ? (
                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-theme-secondary uppercase">Editing Staff Member</label>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 px-3 py-2 bg-theme-bg border border-theme-primary rounded-lg focus:outline-none focus:border-emerald-500"
                                            placeholder="Name"
                                            autoFocus
                                        />
                                        <select
                                            value={editRole}
                                            onChange={(e) => setEditRole(e.target.value as any)}
                                            className="w-full sm:w-32 px-3 py-2 bg-theme-bg border border-theme-primary rounded-lg capitalize focus:outline-none focus:border-emerald-500"
                                        >
                                            <option value="staff">Staff</option>
                                            <option value="chef">Chef</option>
                                            <option value="manager">Manager</option>
                                        </select>
                                        <input
                                            value={editCode}
                                            onChange={(e) => setEditCode(e.target.value)}
                                            className="w-full sm:w-24 px-3 py-2 bg-theme-bg border border-theme-primary rounded-lg font-mono focus:outline-none focus:border-emerald-500 text-center"
                                            placeholder="Code"
                                            inputMode="numeric"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 mt-1">
                                        <button
                                            onClick={() => setEditingStaffId(null)}
                                            className="px-4 py-2 text-theme-secondary hover:text-theme-primary text-xs font-bold"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStaff(staff.id)}
                                            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 shadow-sm"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                                            staff.role === 'manager' ? "bg-purple-100 text-purple-600" :
                                                staff.role === 'chef' ? "bg-orange-100 text-orange-600" :
                                                    "bg-zinc-100 text-zinc-600"
                                        )}>
                                            {staff.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-theme-primary flex items-center gap-2">
                                                {staff.name}
                                                <span className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider",
                                                    staff.role === 'manager' ? "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300" :
                                                        staff.role === 'chef' ? "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300" :
                                                            "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400"
                                                )}>
                                                    {staff.role}
                                                </span>
                                            </h3>
                                            <p className="text-xs text-theme-secondary mt-0.5 font-mono">
                                                Code: <span className="text-foreground/70 font-bold">{staff.staff_code || 'N/A'}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => {
                                                setEditingStaffId(staff.id)
                                                setEditName(staff.name)
                                                setEditRole(staff.role)
                                                setEditCode(staff.staff_code || '')
                                            }}
                                            className="p-2 text-theme-secondary hover:text-sky-500 hover:bg-sky-500/10 rounded-lg transition-colors"
                                            title="Edit Staff Member"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteStaff(staff.id)}
                                            className="p-2 text-theme-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Remove Staff Member"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
