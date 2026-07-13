import React, { useState } from 'react';
import { AlertTriangle, Bot, FileText, CheckCircle, XCircle, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { UnifiedDiagnosis } from '@/lib/db';

interface DiagnosisReconciliationProps {
  aiDiagnoses: UnifiedDiagnosis[];
  manualDiagnoses: UnifiedDiagnosis[];
  onResolveConflict: (resolvedDiagnoses: UnifiedDiagnosis[]) => void;
  onOverrideAI: (manualDiagnosis: UnifiedDiagnosis, aiDiagnosisId: string) => void;
}

export function DiagnosisReconciliation({
  aiDiagnoses,
  manualDiagnoses,
  onResolveConflict,
  onOverrideAI
}: DiagnosisReconciliationProps) {
  const [resolvedDiagnoses, setResolvedDiagnoses] = useState<UnifiedDiagnosis[]>([]);
  const [editingDiagnosis, setEditingDiagnosis] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Find conflicts between AI and manual diagnoses
  const findConflicts = () => {
    const conflicts: {
      ai: UnifiedDiagnosis;
      manual: UnifiedDiagnosis;
      similarity: number;
    }[] = [];

    aiDiagnoses.forEach(aiDiag => {
      manualDiagnoses.forEach(manualDiag => {
        if (aiDiag.type === manualDiag.type) {
          const similarity = calculateSimilarity(aiDiag.diagnosis, manualDiag.diagnosis);
          if (similarity < 0.8) { // Less than 80% similar = potential conflict
            conflicts.push({ ai: aiDiag, manual: manualDiag, similarity });
          }
        }
      });
    });

    return conflicts;
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  const conflicts = findConflicts();
  const hasConflicts = conflicts.length > 0;

  const handleOverrideAI = (manualDiag: UnifiedDiagnosis, aiDiagnosisOrId: UnifiedDiagnosis | string) => {
    // If aiDiagnosisOrId is a string, find the corresponding AI diagnosis
    const aiDiagnosis = typeof aiDiagnosisOrId === 'string' 
      ? aiDiagnoses.find(d => d.id === aiDiagnosisOrId)
      : aiDiagnosisOrId;
    
    if (aiDiagnosis) {
      onOverrideAI(manualDiag, aiDiagnosis.id);
    }
  };

  const handleEditDiagnosis = (diagnosisId: string, currentText: string) => {
    setEditingDiagnosis(diagnosisId);
    setEditText(currentText);
  };

  const handleSaveEdit = (diagnosisId: string) => {
    // Update the diagnosis with edited text
    const updatedDiagnoses = [...aiDiagnoses, ...manualDiagnoses].map(diag => 
      diag.id === diagnosisId ? { ...diag, diagnosis: editText } : diag
    );
    setResolvedDiagnoses(updatedDiagnoses);
    setEditingDiagnosis(null);
    setEditText('');
  };

  const allDiagnoses = [...aiDiagnoses, ...manualDiagnoses];

  if (!hasConflicts && aiDiagnoses.length === 0 && manualDiagnoses.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-5 w-5" />
          Diagnosis Reconciliation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasConflicts && (
          <div className="space-y-3">
            <h4 className="font-medium text-amber-700">Conflicting Diagnoses Detected</h4>
            {conflicts.map((conflict, index) => (
              <div key={index} className="border border-amber-200 rounded-lg p-3 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* AI Diagnosis */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">AI Suggestion</span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(conflict.similarity * 100)}% match
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700">{conflict.ai.diagnosis}</p>
                    {conflict.ai.confidence && (
                      <p className="text-xs text-slate-500">
                        Confidence: {Math.round(conflict.ai.confidence * 100)}%
                      </p>
                    )}
                  </div>

                  {/* Manual Diagnosis */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Manual Entry</span>
                    </div>
                    <div className="space-y-2">
                      {editingDiagnosis === conflict.manual.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(conflict.manual.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingDiagnosis(null)}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-slate-700 flex-1">{conflict.manual.diagnosis}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditDiagnosis(conflict.manual.id, conflict.manual.diagnosis)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resolution Actions */}
                <div className="flex gap-2 pt-2 border-t border-amber-100">
                  <Button
                    size="sm"
                    onClick={() => handleOverrideAI(conflict.manual, conflict.ai)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Use Manual Diagnosis
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOverrideAI(conflict.manual, conflict.ai.id)}
                  >
                    Keep AI Diagnosis
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All Diagnoses Summary */}
        <div className="space-y-2">
          <h4 className="font-medium text-amber-700">All Diagnoses</h4>
          <div className="space-y-2">
            {allDiagnoses.map((diagnosis, index) => (
              <div key={diagnosis.id} className="flex items-center justify-between p-2 bg-white rounded border border-amber-100">
                <div className="flex items-center gap-2">
                  {diagnosis.source === 'ai' ? (
                    <Bot className="h-4 w-4 text-blue-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-sm">{diagnosis.diagnosis}</span>
                  <Badge variant="outline" className="text-xs">
                    {diagnosis.type}
                  </Badge>
                </div>
                <Badge 
                  variant={diagnosis.source === 'ai' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {diagnosis.source}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Resolution Actions */}
        <div className="flex gap-2 pt-3 border-t border-amber-200">
          <Button
            onClick={() => onResolveConflict(allDiagnoses)}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Accept Current Diagnoses
          </Button>
          <Button
            variant="outline"
            onClick={() => onResolveConflict([])}
          >
            Clear All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
