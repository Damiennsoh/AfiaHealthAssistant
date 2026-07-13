import { useState, useEffect } from 'react';
import { VitalAlert, ReferralTrigger } from '@/lib/db';

export function useVitalAlerts(vitals: {
  temperature?: string;
  bloodPressureSystolic?: string;
  bloodPressureDiastolic?: string;
  pulse?: string;
  respiratoryRate?: string;
  spO2?: string;
  weight?: string;
  height?: string;
}) {
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);
  const [referralTriggers, setReferralTriggers] = useState<ReferralTrigger[]>([]);

  useEffect(() => {
    const newAlerts: VitalAlert[] = [];
    const newTriggers: ReferralTrigger[] = [];

    // BMI Calculation
    const weight = parseFloat(vitals.weight || '0');
    const heightCm = parseFloat(vitals.height || '0');
    
    if (weight > 0 && heightCm > 0) {
      const heightM = heightCm / 100;
      const bmi = parseFloat((weight / (heightM * heightM)).toFixed(1));

      if (bmi > 30) {
        newAlerts.push({
          type: 'clinical_warning',
          severity: 'warning',
          message: 'Obesity - High cardiovascular risk',
          value: `BMI ${bmi}`
        });
        // Triggers referral if BMI > 35 (Severe Obesity) or just flag it?
        // User asked for "obesity" to trigger referral note.
        // Let's set trigger for Severe Obesity (>35) or Class I (>30) depending on strictness.
        // GHS usually refers for management of complications. Let's use >35 or >40 as critical.
        // However, for the purpose of "Referral Note", let's be safe and trigger on > 35.
        if (bmi > 35) {
             newTriggers.push({
            reason: 'Severe Obesity requiring specialist management',
            vitalType: 'BMI',
            threshold: '> 35',
            actualValue: `${bmi}`,
            triggeredAt: new Date().toISOString()
          });
        }
      }

      if (bmi < 16) {
        newAlerts.push({
          type: 'clinical_critical',
          severity: 'critical',
          message: 'Severe Malnutrition / Underweight',
          value: `BMI ${bmi}`
        });
        newTriggers.push({
          reason: 'Severe Malnutrition requiring urgent nutritional rehabilitation',
          vitalType: 'BMI',
          threshold: '< 16',
          actualValue: `${bmi}`,
          triggeredAt: new Date().toISOString()
        });
      }
    }

    // Blood Pressure checks
    const systolic = parseFloat(vitals.bloodPressureSystolic || '0');
    const diastolic = parseFloat(vitals.bloodPressureDiastolic || '0');
    
    if (systolic > 180) {
      newAlerts.push({
        type: 'bp_high',
        severity: 'critical',
        message: 'Critically high systolic blood pressure',
        value: `${systolic} mmHg`
      });
      newTriggers.push({
        reason: 'Hypertensive crisis - Systolic BP extremely elevated',
        vitalType: 'Blood Pressure (Systolic)',
        threshold: '> 180 mmHg',
        actualValue: `${systolic} mmHg`,
        triggeredAt: new Date().toISOString()
      });
    } else if (systolic > 160) {
      newAlerts.push({
        type: 'bp_high',
        severity: 'warning',
        message: 'High systolic blood pressure',
        value: `${systolic} mmHg`
      });
    }

    if (systolic < 90 && systolic > 0) {
      newAlerts.push({
        type: 'bp_low',
        severity: 'critical',
        message: 'Critically low systolic blood pressure',
        value: `${systolic} mmHg`
      });
      newTriggers.push({
        reason: 'Hypotension - Systolic BP critically low',
        vitalType: 'Blood Pressure (Systolic)',
        threshold: '< 90 mmHg',
        actualValue: `${systolic} mmHg`,
        triggeredAt: new Date().toISOString()
      });
    }

    if (diastolic > 110) {
      newAlerts.push({
        type: 'bp_high',
        severity: 'critical',
        message: 'Critically high diastolic blood pressure',
        value: `${diastolic} mmHg`
      });
      newTriggers.push({
        reason: 'Hypertensive crisis - Diastolic BP extremely elevated',
        vitalType: 'Blood Pressure (Diastolic)',
        threshold: '> 110 mmHg',
        actualValue: `${diastolic} mmHg`,
        triggeredAt: new Date().toISOString()
      });
    }

    // Temperature checks
    const temp = parseFloat(vitals.temperature || '0');
    if (temp > 39) {
      newAlerts.push({
        type: 'temp_high',
        severity: 'critical',
        message: 'High fever - potential serious infection',
        value: `${temp}°C`
      });
      newTriggers.push({
        reason: 'High fever requiring urgent evaluation',
        vitalType: 'Temperature',
        threshold: '> 39°C',
        actualValue: `${temp}°C`,
        triggeredAt: new Date().toISOString()
      });
    } else if (temp > 38) {
      newAlerts.push({
        type: 'temp_high',
        severity: 'warning',
        message: 'Fever - monitor closely',
        value: `${temp}°C`
      });
    }

    if (temp < 35 && temp > 0) {
      newAlerts.push({
        type: 'temp_low',
        severity: 'critical',
        message: 'Hypothermia - immediate warming required',
        value: `${temp}°C`
      });
      newTriggers.push({
        reason: 'Hypothermia requiring immediate intervention',
        vitalType: 'Temperature',
        threshold: '< 35°C',
        actualValue: `${temp}°C`,
        triggeredAt: new Date().toISOString()
      });
    }

    // SpO2 checks
    const spo2 = parseFloat(vitals.spO2 || '0');
    if (spo2 > 0 && spo2 < 90) {
      newAlerts.push({
        type: 'spo2_low',
        severity: 'critical',
        message: 'Critically low oxygen saturation',
        value: `${spo2}%`
      });
      newTriggers.push({
        reason: 'Hypoxia - Low oxygen saturation',
        vitalType: 'SpO2',
        threshold: '< 90%',
        actualValue: `${spo2}%`,
        triggeredAt: new Date().toISOString()
      });
    } else if (spo2 > 0 && spo2 < 94) {
      newAlerts.push({
        type: 'spo2_low',
        severity: 'warning',
        message: 'Low oxygen saturation - monitor closely',
        value: `${spo2}%`
      });
    }

    // Pulse checks
    const pulse = parseFloat(vitals.pulse || '0');
    if (pulse > 120) {
      newAlerts.push({
        type: 'pulse_high',
        severity: 'critical',
        message: 'Tachycardia - abnormally high heart rate',
        value: `${pulse} bpm`
      });
      newTriggers.push({
        reason: 'Tachycardia requiring evaluation',
        vitalType: 'Pulse',
        threshold: '> 120 bpm',
        actualValue: `${pulse} bpm`,
        triggeredAt: new Date().toISOString()
      });
    } else if (pulse > 100) {
      newAlerts.push({
        type: 'pulse_high',
        severity: 'warning',
        message: 'Elevated heart rate',
        value: `${pulse} bpm`
      });
    }

    if (pulse < 50 && pulse > 0) {
      newAlerts.push({
        type: 'pulse_low',
        severity: 'critical',
        message: 'Bradycardia - abnormally low heart rate',
        value: `${pulse} bpm`
      });
      newTriggers.push({
        reason: 'Bradycardia requiring evaluation',
        vitalType: 'Pulse',
        threshold: '< 50 bpm',
        actualValue: `${pulse} bpm`,
        triggeredAt: new Date().toISOString()
      });
    }

    // Respiratory rate checks
    const respRate = parseFloat(vitals.respiratoryRate || '0');
    if (respRate > 30) {
      newAlerts.push({
        type: 'resp_high',
        severity: 'critical',
        message: 'Tachypnea - abnormally high respiratory rate',
        value: `${respRate} /min`
      });
      newTriggers.push({
        reason: 'Tachypnea requiring urgent evaluation',
        vitalType: 'Respiratory Rate',
        threshold: '> 30 /min',
        actualValue: `${respRate} /min`,
        triggeredAt: new Date().toISOString()
      });
    } else if (respRate > 24) {
      newAlerts.push({
        type: 'resp_high',
        severity: 'warning',
        message: 'Elevated respiratory rate',
        value: `${respRate} /min`
      });
    }

    if (respRate < 10 && respRate > 0) {
      newAlerts.push({
        type: 'resp_low',
        severity: 'critical',
        message: 'Bradypnea - abnormally low respiratory rate',
        value: `${respRate} /min`
      });
      newTriggers.push({
        reason: 'Bradypnea requiring immediate evaluation',
        vitalType: 'Respiratory Rate',
        threshold: '< 10 /min',
        actualValue: `${respRate} /min`,
        triggeredAt: new Date().toISOString()
      });
    }

    setAlerts(newAlerts);
    setReferralTriggers(newTriggers);
  }, [vitals]);

  const hasCriticalAlerts = alerts.some(alert => alert.severity === 'critical');
  const hasReferralTriggers = referralTriggers.length > 0;

  return {
    alerts,
    referralTriggers,
    hasCriticalAlerts,
    hasReferralTriggers,
    clearAlerts: () => {
      setAlerts([]);
      setReferralTriggers([]);
    }
  };
}
