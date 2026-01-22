import type { ComplianceSchema } from '../types';

export const fsaiDailyCleaningSchema: ComplianceSchema = {
  id: 'fsai_daily_cleaning_v1',
  title: 'Daily Cleaning Schedule (FSAI)',
  region: 'IE',
  type: 'cleaning',
  version: '1.0.0',
  fields: [
    {
      id: 'area',
      label: 'Area / Equipment',
      type: 'select',
      validation: { 
        required: true, 
        options: [
            'Prep Surfaces', 
            'Sinks & Taps', 
            'Floors', 
            'Walk-in Fridge', 
            'Line Fridge', 
            'Cookline (Hob/Grill)',
            'Dishwasher Area'
        ] 
      }
    },
    {
      id: 'chemicals_used',
      label: 'Chemicals Used',
      type: 'select',
      validation: { 
        required: true,
        options: ['Sanitizer D10', 'Degreaser', 'Floor Cleaner', 'Hot Soapy Water']
      }
    },
    {
      id: 'method',
      label: 'Cleaning Method',
      type: 'text',
      validation: { required: true },
      defaultValue: 'Clean, Rinse, Sanitize, Air Dry'
    },
    {
      id: 'time_completed',
      label: 'Time Completed',
      type: 'time',
      validation: { required: true },
    },
    {
      id: 'cleaned_by',
      label: 'Cleaned By',
      type: 'text',
      validation: { required: true }
    },
    {
      id: 'verified_by_manager',
      label: 'Manager Verification',
      type: 'boolean',
      validation: { required: true },
      helpText: 'I verify this area meets hygiene standards.'
    }
  ],
  correctiveActions: [
    {
      trigger: 'verified_by_manager == false',
      actions: [
        'Reclean area immediately',
        'Retrain staff on cleaning procedure'
      ]
    }
  ]
};
