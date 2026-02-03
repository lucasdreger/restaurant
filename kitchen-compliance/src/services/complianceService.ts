import { supabase } from '@/lib/supabase';
import type { ComplianceLogData } from '@/components/haccp/types'; // Fixed type-only import

/**
 * Simulates sending data from an IoT sensor (e.g., Bluetooth/Wi-Fi Thermometer)
 * Can be called via browser console or external script.
 */
export async function mockIotSensorReading(siteId: string, temp: number, unitName = 'Walk-in Fridge 1') {
  console.log(`📡 Simulating IoT Sensor: ${unitName} reading ${temp}°C...`);

  const payload: ComplianceLogData = {
    unit_name: unitName,
    temperature: temp,
    time_check: new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' }),
    checked_by: 'IoT Sensor 01',
    is_clean: true // Sensors usually only measure temperature, we assume clean or ignore
  };

  const { data, error } = await ((supabase
    .from('compliance_logs') as any) // Cast to any to bypass TS check until types are regenerated
    .insert({
      site_id: siteId,
      schema_id: 'fsai_fridge_temp_v1',
      data: payload,
      status: temp > 8 ? 'fail' : 'pass', // Simple validation logic at the "Edge"
      source: 'iot_sensor'
    })
    .select());

  if (error) {
    console.error('❌ IoT Sync Error:', error.message);
    return null;
  }

  console.log('✅ IoT Data Synced:', data);
  return data;
}

/**
 * Saves a log from the App or Voice
 */
export async function saveComplianceLog(siteId: string, schemaId: string, data: ComplianceLogData, source: 'app' | 'voice' = 'app') {
    // Basic validation logic logic inside App before sending
    let status = 'pass';
    
    // Example of a "Hardcoded" rule for demo (ideally would come from Schema parser)
    if (data.temperature && Number(data.temperature) > 8) status = 'fail';
    if (data.assessment_pass === false) status = 'fail';
    if (data.verified_by_manager === false) status = 'fail';

    const { data: result, error } = await ((supabase
        .from('compliance_logs') as any) // Cast to any
        .insert({
            site_id: siteId,
            schema_id: schemaId,
            data: data,
            status: status,
            source: source
        })
        .select());

    if (error) {
        throw new Error(error.message);
    }
    return result;
}
