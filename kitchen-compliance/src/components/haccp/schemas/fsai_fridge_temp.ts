import type { ComplianceSchema } from '../types';

export const fsaiFridgeTempSchema: ComplianceSchema = {
  id: 'fsai_fridge_temp_v1',
  title: 'Cold Storage Temperature Log (FSAI)',
  region: 'IE',
  type: 'temp_log',
  version: '1.0.0',
  fields: [
    {
      id: 'unit_name',
      label: 'Unit Name / ID',
      type: 'text',
      validation: { required: true },
      placeholder: 'e.g., Walk-in Fridge 1',
    },
    {
      id: 'temperature',
      label: 'Current Temperature',
      type: 'temperature',
      validation: { 
        required: true, 
        min: -5, 
        max: 8, 
        unit: '°C' 
      },
      helpText: 'Ensure probe is stabilized before recording.',
    },
    {
      id: 'time_check',
      label: 'Time of Check',
      type: 'time',
      validation: { required: true },
    },
    {
      id: 'checked_by',
      label: 'Checked By',
      type: 'text',
      validation: { required: true },
      defaultValue: 'Current User', // Placeholder for logic
    },
    {
      id: 'is_clean',
      label: 'Unit Clean & Organize?',
      type: 'boolean',
      validation: { required: true },
    }
  ],
  correctiveActions: [
    {
      trigger: 'temperature > 5',
      actions: [
        'Check door seal',
        'Move food to backup unit',
        'Call maintenance if persists > 2h'
      ]
    },
    {
      trigger: 'temperature > 8',
      actions: [
        'CRITICAL: Discard high-risk food',
        'Quarantine unit immediately'
      ]
    }
  ]
};
