import { useState } from 'react'
import { ArrowLeft, ClipboardCheck, CheckCircle2, Calendar, Download, TrendingUp, Shield, FileText, Clock, Plus, Thermometer, Users as UsersIcon, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SchemaRenderer } from '@/components/haccp/schema_renderer/SchemaRenderer'
import { fsaiFridgeTempSchema } from '@/components/haccp/schemas/fsai_fridge_temp'
import { fsaiDailyCleaningSchema } from '@/components/haccp/schemas/fsai_daily_cleaning'
import { fsaiStaffTrainingSchema } from '@/components/haccp/schemas/fsai_staff_training'
import type { ComplianceLogData, ComplianceSchema } from '@/components/haccp/types'
import { saveComplianceLog } from '@/services/complianceService'
import { useAppStore } from '@/store/useAppStore'
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner'

interface ComplianceScreenProps {
  onBack: () => void
}

// Mock compliance data
const complianceMetrics = {
  overallScore: 96,
  coolingCompliance: 98,
  temperatureCompliance: 94,
  documentationRate: 97,
  lastAudit: '2026-01-15',
  nextAudit: '2026-02-15',
}

const recentAudits = [
  { 
    id: '1', 
    date: '2026-01-15', 
    type: 'Daily Self-Check',
    score: 100, 
    status: 'passed',
    findings: 0 
  },
  { 
    id: '2', 
    date: '2026-01-14', 
    type: 'Daily Self-Check',
    score: 95, 
    status: 'passed',
    findings: 1 
  },
  { 
    id: '3', 
    date: '2026-01-10', 
    type: 'FSAI Inspection',
    score: 96, 
    status: 'passed',
    findings: 2 
  },
  { 
    id: '4', 
    date: '2026-01-07', 
    type: 'Internal Audit',
    score: 92, 
    status: 'action-needed',
    findings: 3 
  },
]

const complianceChecklist = [
  { id: '1', category: 'Cooling Records', items: 12, completed: 12, status: 'complete' },
  { id: '2', category: 'Temperature Logs', items: 24, completed: 23, status: 'in-progress' },
  { id: '3', category: 'Staff Training', items: 8, completed: 8, status: 'complete' },
  { id: '4', category: 'Equipment Calibration', items: 6, completed: 5, status: 'in-progress' },
  { id: '5', category: 'Cleaning Records', items: 15, completed: 15, status: 'complete' },
  { id: '6', category: 'Supplier Documentation', items: 10, completed: 10, status: 'complete' },
]

export function ComplianceScreen({ onBack }: ComplianceScreenProps) {
  const [showLogForm, setShowLogForm] = useState(false)
  const [activeSchema, setActiveSchema] = useState(fsaiFridgeTempSchema)
  const [isExporting, setIsExporting] = useState(false)
  const { currentSite } = useAppStore()

  const handleOpenSchema = (schema: ComplianceSchema) => {
    setActiveSchema(schema);
    setShowLogForm(true);
  }

  const handleExportPDF = () => {
    setIsExporting(true);
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("Kitchen Compliance Report", 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Location: Dublin City Centre Branch`, 14, 36);

    // Summary Section
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 45, 196, 45);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Compliance Summary", 14, 55);

    autoTable(doc, {
      startY: 60,
      head: [['Metric', 'Score', 'Status']],
      body: [
        ['Overall Score', '96%', 'Excellent'],
        ['Cooling Compliance', '98%', 'Passing'],
        ['Temp. Checks', '94%', 'Passing'],
        ['Documentation', '97%', 'Passing'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
    });

    // Recent Audits Section (using mock data from component)
    const finalY = (doc as any).lastAutoTable.finalY || 60;
    
    doc.text("Recent Audit Logs", 14, finalY + 15);

    autoTable(doc, {
      startY: finalY + 20,
      head: [['Date', 'Type', 'Score', 'Status', 'Findings']],
      body: recentAudits.map(audit => [
        audit.date,
        audit.type,
        `${audit.score}%`,
        audit.status.toUpperCase(),
        audit.findings.toString()
      ]),
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text('Kitchen Ops - Official FSAI Compliance Record', 14, 285);
      doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }

    doc.save(`compliance-report-${new Date().toISOString().split('T')[0]}.pdf`);
    setIsExporting(false);
    toast.success('Report downloaded successfully');
  }

  const handleLogSave = async (data: ComplianceLogData) => {
    // Save to Supabase (or mock if offline/no site)
    if (currentSite?.id) {
       try {
         await saveComplianceLog(currentSite.id, activeSchema.id, data, 'app');
         toast.success('Log saved to cloud successfully!');
       } catch (err) {
         console.error('Save failed', err);
         toast.error('Failed to save log to cloud.');
       }
    } else {
      toast.info('No site selected, log saved locally (mock)');
    }

    setShowLogForm(false)
  }

  if (showLogForm) {
    return (
      <div className="min-h-screen bg-theme-primary text-theme-primary p-6 md:p-12 animate-fade-in">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => setShowLogForm(false)}
            className="p-3 rounded-full hover:bg-theme-ghost transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-light tracking-tight">New Entry</h1>
            <p className="text-theme-muted font-light">Compliance Log • {activeSchema.region}</p>
          </div>
        </div>
        
        <div className="card-stunning p-6">
            <SchemaRenderer 
            schema={activeSchema} 
            onSave={handleLogSave} 
            />
        </div>
      </div>
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 95) return 'text-green-500'
    if (score >= 80) return 'text-amber-500'
    return 'text-red-500'
  }

  return (
    <div className="min-h-screen bg-theme-primary text-theme-primary transition-colors duration-300">
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-glass-heavy border-b border-theme-primary p-4 md:p-6 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-3 rounded-xl hover:bg-theme-ghost text-theme-secondary hover:text-theme-primary transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-theme-primary to-theme-secondary">
                Compliance
              </h1>
              <div className="flex items-center gap-2 mt-1">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                 <p className="text-theme-muted font-medium text-xs uppercase tracking-wider">Live Monitoring</p>
              </div>
            </div>
         </div>
         
         <div className="flex gap-3">
            <button 
              onClick={handleExportPDF}
              disabled={isExporting}
              className="btn-stunning btn-ghost flex items-center gap-2"
            >
              <Download size={18} />
              {isExporting ? 'Generating...' : 'Export Report'}
            </button>
            <button 
              onClick={() => handleOpenSchema(fsaiFridgeTempSchema)}
              className="btn-stunning btn-primary flex items-center gap-2"
            >
              <Plus size={18} />
              New Log Entry
            </button>
         </div>
        </div>
      </div>

      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 pb-24">

       {/* Quick Actions / Schema Selection */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <button 
              onClick={() => handleOpenSchema(fsaiFridgeTempSchema)}
              className="p-4 text-left card-stunning hover:border-theme-secondary transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors">
                   <Thermometer size={20} />
                 </div>
                 <span className="font-semibold">Temperature Log</span>
              </div>
              <p className="text-sm text-theme-muted">Fridges, Freezers & Blast Chillers</p>
            </button>

            <button 
              onClick={() => handleOpenSchema(fsaiDailyCleaningSchema)}
              className="p-4 text-left card-stunning hover:border-theme-secondary transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                   <Sparkles size={20} />
                 </div>
                 <span className="font-semibold">Cleaning Schedule</span>
              </div>
              <p className="text-sm text-theme-muted">Daily, Weekly & Deep Clean Tasks</p>
            </button>

             <button 
              onClick={() => handleOpenSchema(fsaiStaffTrainingSchema)}
              className="p-4 text-left card-stunning hover:border-theme-secondary transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg group-hover:bg-purple-500 group-hover:text-white transition-colors">
                   <UsersIcon size={20} />
                 </div>
                 <span className="font-semibold">Staff Training</span>
              </div>
              <p className="text-sm text-theme-muted">Induction & Allergen Certs</p>
            </button>
       </div>

      {/* Stats Grid - "Apple clean" style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Overall Score */}
        <div className="card-stunning p-6 flex flex-col justify-between h-40 group">
           <div>
             <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider">Overall Score</h3>
           </div>
           <div className="flex items-end justify-between">
              <span className="text-5xl font-light tracking-tighter text-theme-primary">
                {complianceMetrics.overallScore}%
              </span>
              <TrendingUp className="w-6 h-6 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
           </div>
        </div>

        {/* Cooling */}
        <div className="card-stunning p-6 flex flex-col justify-between h-40 group">
           <div>
             <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider">Cooling Safety</h3>
           </div>
           <div className="flex items-end justify-between">
              <span className="text-5xl font-light tracking-tighter text-theme-primary">
                {complianceMetrics.coolingCompliance}%
              </span>
              <Shield className="w-6 h-6 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
           </div>
        </div>

        {/* Audit Status */}
        <div className="card-stunning p-6 flex flex-col justify-between h-40 group">
           <div>
             <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider">Next Audit</h3>
             <p className="text-xs text-theme-muted mt-1">Scheduled Inspection</p>
           </div>
           <div className="flex items-end justify-between">
              <span className="text-2xl font-light text-theme-primary">
                Feb 15
              </span>
              <Calendar className="w-6 h-6 text-theme-muted mb-2" />
           </div>
        </div>
        
        {/* Actions Required */}
        <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5 shadow-sm flex flex-col justify-between h-40">
           <div>
             <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider">Action Needed</h3>
           </div>
           <div className="flex items-end justify-between">
              <span className="text-4xl font-light tracking-tighter text-red-500">
                3
              </span>
              <div className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-bold">
                URGENT
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content - Checklist */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-light tracking-tight text-theme-primary flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-theme-muted" />
            Daily Tasks
          </h2>
          
          <div className="space-y-3">
            {complianceChecklist.map((item) => (
              <div 
                key={item.id}
                className="group card-stunning p-4 cursor-pointer flex items-center justify-between hover:scale-[1.01] transition-transform"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    item.status === 'complete' 
                      ? "bg-emerald-500/10 text-emerald-500" 
                      : "bg-theme-ghost text-theme-muted"
                  )}>
                    {item.status === 'complete' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                  </div>
                  <div>
                    <h3 className="font-medium text-theme-primary">{item.category}</h3>
                    <p className="text-sm text-theme-muted">
                      {item.completed}/{item.items} verified
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                   {/* Progress Bar */}
                   <div className="w-24 h-1.5 bg-theme-ghost rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-theme-primary rounded-full" 
                        style={{ width: `${(item.completed / item.items) * 100}%` }}
                      />
                   </div>
                   <ArchiveIcon className="w-4 h-4 text-theme-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar - Recent Audits */}
        <div className="space-y-6">
           <h2 className="text-xl font-light tracking-tight text-theme-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-theme-muted" />
            Recent Logs
          </h2>

          <div className="bg-theme-ghost rounded-2xl p-1 border border-theme-primary">
             {recentAudits.map((audit) => (
                <div 
                  key={audit.id}
                  className="p-4 hover:bg-theme-card rounded-xl transition-colors border-b border-theme-ghost last:border-0"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-theme-primary">{audit.type}</span>
                    <span className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded-full uppercase",
                      audit.status === 'passed' ? "bg-emerald-500/10 text-emerald-600" :
                      "bg-amber-500/10 text-amber-600"
                    )}>
                      {audit.status === 'action-needed' ? 'Action' : 'Pass'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-xs text-theme-muted">{audit.date}</span>
                    <div className="text-right">
                       <span className={cn(
                         "font-bold",
                         getScoreColor(audit.score)
                       )}>
                         {audit.score}%
                       </span>
                    </div>
                  </div>
                </div>
             ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  )
}
