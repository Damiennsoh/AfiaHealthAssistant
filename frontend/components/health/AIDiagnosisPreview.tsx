import React, { useState } from 'react';
import { Bot, CheckCircle2, Edit2, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface AIDiagnosisPreviewProps {
  data: {
    primaryDiagnosis: string;
    secondaryDiagnosis: string;
    treatmentPlan: string;
    clinicalNotes: string;
    followUpInstructions: string;
    medications?: Array<{
      name: string;
      dosage: string;
      frequency: string;
      route: string;
      duration: string;
    }>;
  };
  confidence?: number;
  onApply: (data: any) => void;
  onCancel: () => void;
}

export function AIDiagnosisPreview({ 
  data, 
  confidence = 0.8, 
  onApply, 
  onCancel 
}: AIDiagnosisPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(data);

  const handleApply = () => {
    onApply(isEditing ? editedData : data);
  };

  const handleEdit = (field: string, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg text-blue-800">AI Diagnosis Preview</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
              {Math.round(confidence * 100)}% Confidence
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="text-blue-600 hover:text-blue-800"
            >
              {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Primary Diagnosis */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-blue-700">Primary Diagnosis *</label>
          {isEditing ? (
            <Input
              value={editedData.primaryDiagnosis}
              onChange={(e) => handleEdit('primaryDiagnosis', e.target.value)}
              placeholder="e.g. Uncomplicated Malaria, Typhoid Fever"
              className="bg-white border-blue-200"
            />
          ) : (
            <div className="p-3 bg-white rounded-lg border border-blue-100">
              <p className="text-slate-800">{data.primaryDiagnosis || 'Not provided'}</p>
            </div>
          )}
        </div>

        {/* Secondary Diagnosis */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-blue-700">Secondary Diagnosis (Optional)</label>
          {isEditing ? (
            <Input
              value={editedData.secondaryDiagnosis}
              onChange={(e) => handleEdit('secondaryDiagnosis', e.target.value)}
              placeholder="e.g. Dehydration, Anemia"
              className="bg-white border-blue-200"
            />
          ) : (
            <div className="p-3 bg-white rounded-lg border border-blue-100">
              <p className="text-slate-800">{data.secondaryDiagnosis || 'None'}</p>
            </div>
          )}
        </div>

        {/* Treatment Plan */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-blue-700">Treatment Plan *</label>
          {isEditing ? (
            <Textarea
              value={editedData.treatmentPlan}
              onChange={(e) => handleEdit('treatmentPlan', e.target.value)}
              placeholder="Medications, dosages, and duration..."
              rows={4}
              className="bg-white border-blue-200"
            />
          ) : (
            <div className="p-3 bg-white rounded-lg border border-blue-100">
              <p className="text-slate-800 whitespace-pre-wrap">{data.treatmentPlan || 'Not provided'}</p>
            </div>
          )}
        </div>

        {/* Clinical Notes */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-blue-700">Clinical Notes</label>
          {isEditing ? (
            <Textarea
              value={editedData.clinicalNotes}
              onChange={(e) => handleEdit('clinicalNotes', e.target.value)}
              placeholder="Detailed clinical assessment and findings..."
              rows={3}
              className="bg-white border-blue-200"
            />
          ) : (
            <div className="p-3 bg-white rounded-lg border border-blue-100">
              <p className="text-slate-800 whitespace-pre-wrap">{data.clinicalNotes || 'None'}</p>
            </div>
          )}
        </div>

        {/* Follow-up Instructions */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-blue-700">Follow-up Instructions</label>
          {isEditing ? (
            <Textarea
              value={editedData.followUpInstructions}
              onChange={(e) => handleEdit('followUpInstructions', e.target.value)}
              placeholder="Return for follow-up in... Warning signs..."
              rows={2}
              className="bg-white border-blue-200"
            />
          ) : (
            <div className="p-3 bg-white rounded-lg border border-blue-100">
              <p className="text-slate-800 whitespace-pre-wrap">{data.followUpInstructions || 'None'}</p>
            </div>
          )}
        </div>

        {/* Medications Summary */}
        {data.medications && data.medications.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-blue-700">Medications to Apply</label>
            <div className="space-y-2">
              {data.medications.map((med, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-blue-100">
                  <Pill className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-slate-800">{med.name}</span>
                  <span className="text-sm text-slate-600">
                    {med.dosage}, {med.route}, {med.frequency}, {med.duration}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-blue-200">
          <Button
            onClick={handleApply}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isEditing ? 'Apply Changes' : 'Apply to Encounter'}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Import Pill icon
import { Pill } from "lucide-react";
