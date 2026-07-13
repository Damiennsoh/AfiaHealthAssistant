"use client";

import { useState } from "react";
import { Plus, Trash2, FileText, Upload, TestTube, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LabResult } from "@/lib/db";
import { generateId } from "@/lib/db";
import { toast } from "sonner";

interface LabResultsProps {
  labResults: LabResult[];
  onAddLabResult: (result: LabResult) => void;
  onRemoveLabResult: (resultId: string) => void;
  readOnly?: boolean;
}

const COMMON_TESTS = [
  "Malaria RDT",
  "Blood Glucose",
  "Hemoglobin (HB)",
  "Pregnancy Test",
  "HIV Test",
  "Hepatitis B Test",
  "Urine Test",
  "Stool Microscopy",
  "Sputum AFB",
  "Widal Test",
  "Blood Group & Rhesus",
  "Sickle Cell Test",
  "Liver Function Test",
  "Kidney Function Test",
  "Electrolytes",
  "Full Blood Count"
];

export function LabResultsSection({ labResults, onAddLabResult, onRemoveLabResult, readOnly = false }: LabResultsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newResult, setNewResult] = useState<Partial<LabResult>>({
    testType: "",
    result: "",
    normalRange: "",
    unit: "",
    testDate: new Date().toISOString().split('T')[0],
    performedBy: ""
  });

  const handleAddResult = () => {
    if (!newResult.testType || !newResult.result || !newResult.testDate || !newResult.performedBy) {
      toast.error("Please fill in all required fields");
      return;
    }

    const result: LabResult = {
      id: generateId(),
      testType: newResult.testType!,
      result: newResult.result!,
      normalRange: newResult.normalRange,
      unit: newResult.unit,
      testDate: newResult.testDate!,
      performedBy: newResult.performedBy!,
      createdAt: new Date().toISOString()
    };

    onAddLabResult(result);
    setNewResult({
      testType: "",
      result: "",
      normalRange: "",
      unit: "",
      testDate: new Date().toISOString().split('T')[0],
      performedBy: ""
    });
    setShowAddForm(false);
    toast.success("Lab result added successfully");
  };

  const getTestColor = (testType: string, result: string, normalRange?: string) => {
    if (!normalRange) return "default";
    
    // Simple interpretation for common tests
    if (testType.includes("Malaria")) {
      return result.toLowerCase().includes("positive") ? "destructive" : "success";
    }
    if (testType.includes("Glucose")) {
      const value = parseFloat(result);
      const normal = parseFloat(normalRange.split("-")[1] || normalRange);
      return value > normal ? "destructive" : "success";
    }
    if (testType.includes("HB")) {
      const value = parseFloat(result);
      const normal = parseFloat(normalRange.split("-")[0]);
      return value < normal ? "destructive" : "success";
    }
    
    return "default";
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TestTube className="h-5 w-5 text-primary" />
          Lab Results
        </CardTitle>
        {!readOnly && (
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-2"
          >
            {showAddForm ? <Plus className="h-4 w-4 rotate-45" /> : <Plus className="h-4 w-4" />}
            {showAddForm ? "Cancel" : "Add Result"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Lab Result Form */}
        {showAddForm && !readOnly && (
          <div className="grid gap-4 rounded-lg border border-border/40 bg-muted/30 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="testType">Test Type *</Label>
                <Select value={newResult.testType} onValueChange={(value) => setNewResult({...newResult, testType: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select test type" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TESTS.map((test) => (
                      <SelectItem key={test} value={test}>{test}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="result">Result *</Label>
                <Input
                  id="result"
                  placeholder="e.g., Positive, 12.5, Negative"
                  value={newResult.result}
                  onChange={(e) => setNewResult({...newResult, result: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="normalRange">Normal Range</Label>
                <Input
                  id="normalRange"
                  placeholder="e.g., 0-5, Negative, 4.5-5.5"
                  value={newResult.normalRange}
                  onChange={(e) => setNewResult({...newResult, normalRange: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  placeholder="e.g., g/dL, mmol/L, mg/dL"
                  value={newResult.unit}
                  onChange={(e) => setNewResult({...newResult, unit: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="testDate">Test Date *</Label>
                <Input
                  id="testDate"
                  type="date"
                  value={newResult.testDate}
                  onChange={(e) => setNewResult({...newResult, testDate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="performedBy">Performed By *</Label>
                <Input
                  id="performedBy"
                  placeholder="Lab technician/healthcare worker"
                  value={newResult.performedBy}
                  onChange={(e) => setNewResult({...newResult, performedBy: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddResult} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Result
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Lab Results List */}
        {labResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TestTube className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No lab results recorded</p>
            {!readOnly && <p className="text-sm">Click &quot;Add Result&quot; to record test results</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {labResults.map((result) => (
              <div key={result.id} className="flex items-start gap-3 rounded-lg border border-border/40 p-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  getTestColor(result.testType, result.result, result.normalRange) === "destructive" 
                    ? "bg-destructive/10" 
                    : getTestColor(result.testType, result.result, result.normalRange) === "success"
                    ? "bg-success/10"
                    : "bg-muted/50"
                }`}>
                  <TestTube className={`h-5 w-5 ${
                    getTestColor(result.testType, result.result, result.normalRange) === "destructive"
                      ? "text-destructive"
                      : getTestColor(result.testType, result.result, result.normalRange) === "success"
                      ? "text-success"
                      : "text-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{result.testType}</span>
                    <Badge 
                      variant={getTestColor(result.testType, result.result, result.normalRange) === "destructive" ? "destructive" : 
                               getTestColor(result.testType, result.result, result.normalRange) === "success" ? "default" : "outline"}
                      className="text-xs"
                    >
                      {result.result}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {result.normalRange && (
                      <div>Normal Range: {result.normalRange} {result.unit && `(${result.unit})`}</div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {new Date(result.testDate).toLocaleDateString("en-GB")}
                    </div>
                    {result.performedBy && (
                      <div>By: {result.performedBy}</div>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveLabResult(result.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
