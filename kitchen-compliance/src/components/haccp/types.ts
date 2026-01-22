// Type definitions for the Schema Renderer

export type SchemaFieldType = 'number' | 'text' | 'select' | 'boolean' | 'time' | 'temperature';

export interface SchemaValidation {
  min?: number;
  max?: number;
  required?: boolean;
  unit?: string;
  options?: string[];
  pattern?: string;
}

export interface SchemaField {
  id: string;
  label: string;
  type: SchemaFieldType;
  validation: SchemaValidation;
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
}

export interface ComplianceSchema {
  id: string;
  title: string;
  region: string; // 'IE', 'UK', 'US', 'GLOBAL'
  type: 'temp_log' | 'cleaning' | 'delivery' | 'probe_calibration';
  version: string;
  fields: SchemaField[];
  correctiveActions: {
    trigger: string; // e.g., 'temp > 5'
    actions: string[]; // e.g., ['Discard food', 'Move to blast chiller']
  }[];
}

export interface ComplianceLogData {
  [fieldId: string]: any;
}
