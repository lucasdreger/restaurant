import type { ComplianceSchema } from '../types';

export const fsaiStaffTrainingSchema: ComplianceSchema = {
  id: 'fsai_staff_training_v1',
  title: 'Staff Training Record (FSAI)',
  region: 'IE',
  type: 'temp_log', // Technially 'training', but reusing type for now or could expand types
  version: '1.0.0',
  fields: [
    {
      id: 'employee_name',
      label: 'Employee Name',
      type: 'text',
      validation: { required: true }
    },
    {
      id: 'training_module',
      label: 'Training Module',
      type: 'select',
      validation: { 
        required: true,
        options: [
            'Level 1 Food Safety (Induction)',
            'Level 2 Food Safety',
            'Allergen Management Awareness',
            'HACCP Principles',
            'Personal Hygiene',
            'Cross Contamination Prevention'
        ]
      }
    },
    {
      id: 'trainer_name',
      label: 'Trainer / Supervisor',
      type: 'text',
      validation: { required: true }
    },
    {
      id: 'date_completed',
      label: 'Date Completed',
      type: 'text', // Should be date, using text for MVP
      validation: { required: true },
      placeholder: 'YYYY-MM-DD'
    },
    {
      id: 'assessment_pass',
      label: 'Assessment Passed?',
      type: 'boolean',
      validation: { required: true }
    }
  ],
  correctiveActions: [
    {
      trigger: 'assessment_pass == false',
      actions: [
        'Schedule re-training',
        'Limit duties until passed'
      ]
    }
  ]
};
