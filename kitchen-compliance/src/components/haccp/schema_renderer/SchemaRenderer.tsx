import { useState, useEffect } from 'react';
import type { ComplianceSchema, ComplianceLogData, SchemaField } from '../types';
import { GlassCard } from '@/components/ui/GlassCard';
import { AlertTriangle, Thermometer, Clock, Save, Mic, ChevronDown } from 'lucide-react'; // Added ChevronDown
import { cn } from '@/lib/utils';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition'

// Helper input components would go here, simplified for this example
const InputField = ({ field, value, onChange }: { field: SchemaField, value: any, onChange: (val: any) => void }) => {
  if (field.type === 'select') {
     return (
        <div className="space-y-2">
           <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
            {field.label}
            {field.validation.required && <span className="text-red-400">*</span>}
          </label>
          <div className="relative">
            <select
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={cn(
                "w-full px-4 py-3 bg-[var(--bg-input)]/50 border border-[var(--border-primary)] rounded-lg appearance-none",
                "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:bg-white transition-all",
                "text-[var(--text-primary)]"
              )}
            >
              <option value="" disabled>Select an option...</option>
              {field.validation.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
     );
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center justify-between p-4 border border-[var(--border-primary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer" onClick={() => onChange(!value)}>
         <label className="text-sm font-medium text-[var(--text-secondary)] cursor-pointer select-none">
            {field.label}
             {field.validation.required && <span className="text-red-400">*</span>}
         </label>
         <div className={cn(
           "w-6 h-6 rounded border flex items-center justify-center transition-colors",
           value ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 bg-white"
         )}>
           {value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
         </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
        {field.label}
        {field.validation.required && <span className="text-red-400">*</span>}
      </label>
      
      <div className="relative group">
        <input
          type={field.type === 'number' || field.type === 'temperature' ? 'number' : field.type === 'time' ? 'time' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={cn(
            "w-full px-4 py-3 bg-[var(--bg-input)]/50 border border-[var(--border-primary)] rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:bg-white/80 transition-all",
            "placeholder:text-gray-400"
          )}
        />
        {/* Dynamic Icon based on type */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
           {field.type === 'temperature' && <Thermometer size={18} />}
           {field.type === 'time' && <Clock size={18} />}
        </div>
      </div>
      
      {field.helpText && (
        <p className="text-xs text-[var(--text-muted)] pl-1">{field.helpText}</p>
      )}
    </div>
  );
};

interface SchemaRendererProps {
  schema: ComplianceSchema;
  onSave: (data: ComplianceLogData) => void;
  initialData?: ComplianceLogData;
}

export function SchemaRenderer({ schema, onSave, initialData = {} }: SchemaRendererProps) {
  const [formData, setFormData] = useState<ComplianceLogData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeWarnings, setActiveWarnings] = useState<string[]>([]);
  const { startListening, stopListening, isListening } = useVoiceRecognition({
    onTranscript: (text) => processVoiceInput(text)
  });

  // Very basic NLP for demo purposes
  const processVoiceInput = (text: string) => {
    const lower = text.toLowerCase();
    
    // Pattern: "Temperature 5"
    const tempMatch = lower.match(/(?:temperature|degrees|temp)\s*(\d+(?:\.\d+)?)/);
    if (tempMatch) {
       handleChange('temperature', parseFloat(tempMatch[1]));
    }

    // Pattern: "Clean yes/no"
    if (lower.includes('clean yes') || lower.includes('is clean')) {
       handleChange('is_clean', true);
    }
  };

  // Real-time validation
  useEffect(() => {
    const warnings: string[] = [];
    schema.correctiveActions.forEach(rule => {
      // Very basic parser for demo: "temperature > 5"
      const [field, operator, val] = rule.trigger.split(' ');
      const fieldValue = parseFloat(formData[field]);
      const threshold = parseFloat(val);

      if (!isNaN(fieldValue) && !isNaN(threshold)) {
         if (operator === '>' && fieldValue > threshold) {
            warnings.push(...rule.actions);
         }
      }
    });
    setActiveWarnings(warnings);
  }, [formData, schema]);

  const handleChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = () => {
    // Basic validation check
    const newErrors: Record<string, string> = {};
    schema.fields.forEach(field => {
      if (field.validation.required && !formData[field.id]) {
        newErrors[field.id] = 'This field is required';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
  };

  return (
    <GlassCard className="max-w-2xl mx-auto p-6 md:p-8 space-y-8" glow>
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[var(--border-secondary)] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wide">
               {schema.region} Standard
             </span>
             <span className="text-xs text-gray-500">v{schema.version}</span>
          </div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-[var(--gradient-primary)]">
            {schema.title}
          </h2>
          <p className="text-[var(--text-secondary)] mt-1">
            Complete all fields accurately. Records are immutable.
          </p>
        </div>
        <div className="bg-blue-50 p-3 rounded-full text-blue-600">
           <ClipboardCheckIcon size={24} />
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-6">
        {schema.fields.map(field => (
          <div key={field.id} className="animate-slide-in">
             <InputField 
               field={field} 
               value={formData[field.id]} 
               onChange={(val) => handleChange(field.id, val)}
             />
             {errors[field.id] && (
               <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                 <AlertTriangle size={12} /> {errors[field.id]}
               </p>
             )}
          </div>
        ))}
      </div>

      {/* Corrective Actions Warning */}
      {activeWarnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
            <AlertTriangle size={20} />
            <span>Corrective Action Required</span>
          </div>
          <ul className="list-disc list-inside text-red-600 text-sm space-y-1">
            {activeWarnings.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer Actions */}
      <div className="pt-6 border-t border-[var(--border-secondary)] flex items-center justify-between">
         <button 
           className={cn(
             "flex items-center gap-2 transition-colors px-4 py-2 rounded-lg",
             isListening ? "bg-red-100 text-red-600 animate-pulse" : "text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)]"
           )}
           onMouseDown={startListening}
           onMouseUp={stopListening}
           onTouchStart={startListening}
           onTouchEnd={stopListening}
         >
            <Mic size={20} />
            <span className="text-sm font-medium">
              {isListening ? 'Listening...' : 'Hold for Voice Input'}
            </span>
         </button>

         <button 
           onClick={handleSubmit}
           className="px-8 py-3 bg-[var(--accent-primary)] text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all flex items-center gap-2"
         >
           <Save size={18} />
           Sign & Save Record
         </button>
      </div>
    </GlassCard>
  );
}

// Icon helper
function ClipboardCheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  )
}
