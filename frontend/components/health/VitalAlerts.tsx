import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VitalAlert, ReferralTrigger } from '@/lib/db';

interface VitalAlertsProps {
  alerts: VitalAlert[];
  referralTriggers: ReferralTrigger[];
  onClearAlerts: () => void;
  onTriggerReferral: (triggers: ReferralTrigger[]) => void;
}

export function VitalAlerts({ 
  alerts, 
  referralTriggers, 
  onClearAlerts, 
  onTriggerReferral 
}: VitalAlertsProps) {
  if (alerts.length === 0) return null;

  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
  const warningAlerts = alerts.filter(alert => alert.severity === 'warning');

  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Vital Signs Alerts</h3>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClearAlerts}
            className="text-red-600 border-red-200 hover:bg-red-100"
          >
            Clear
          </Button>
        </div>

        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-red-700">Critical - Immediate Attention Required</h4>
            {criticalAlerts.map((alert, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-red-100 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">{alert.message}</p>
                  <p className="text-xs text-red-600">Value: {alert.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Warning Alerts */}
        {warningAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-amber-700">Warnings - Monitor Closely</h4>
            {warningAlerts.map((alert, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">{alert.message}</p>
                  <p className="text-xs text-amber-600">Value: {alert.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Referral Trigger */}
        {referralTriggers.length > 0 && (
          <div className="pt-3 border-t border-red-200">
            <div className="space-y-2">
              <h4 className="font-medium text-red-700">Referral Recommended</h4>
              <div className="space-y-1">
                {referralTriggers.map((trigger, index) => (
                  <p key={index} className="text-sm text-red-600">
                    • {trigger.reason}
                  </p>
                ))}
              </div>
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  onTriggerReferral(referralTriggers);
                }}
                type="button"
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                Generate Referral Note
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
