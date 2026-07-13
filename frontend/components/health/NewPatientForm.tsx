"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { patientDB, generateId, generateFolderNumber } from "@/lib/db"
import { LocalitySelector } from "./LocalitySelector"
import { useSync } from "@/contexts/SyncContext"

export default function NewPatientForm() {
  const router = useRouter()
  const { syncToCloud } = useSync()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    nhisNumber: "",
    hasNHIS: true,
    age: "",
    sex: "",
    region: "",
    community: "",
    phone: "",
  })
  const [folderNumber, setFolderNumber] = useState<string>("")
  const [isPreview, setIsPreview] = useState(true)

  // Generate folder number on component mount for preview only
  useEffect(() => {
    if (isPreview) {
      generateFolderNumber().then(num => {
        setFolderNumber(num)
        setIsPreview(false)
      })
    }
  }, [isPreview])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleLocalityChange = (locality: { region: string; community: string }) => {
    setFormData(prev => ({ 
      ...prev, 
      region: locality.region, 
      community: locality.community 
    }))
  }

  const validateForm = () => {
    const errors: string[] = []

    if (!formData.name.trim()) errors.push("Patient name is required")
    if (formData.hasNHIS && !formData.nhisNumber.trim()) errors.push("NHIS number is required when NHIS is selected")
    if (!formData.age || parseInt(formData.age) < 0 || parseInt(formData.age) > 120) {
      errors.push("Valid age is required")
    }
    if (!formData.sex) errors.push("Gender is required")
    if (!formData.region) errors.push("Region is required")
    if (!formData.community.trim()) errors.push("Community/Town is required")

    // NHIS number validation (8 digits) - only if hasNHIS is true
    if (formData.hasNHIS && formData.nhisNumber && !/^\d{8}$/.test(formData.nhisNumber)) {
      errors.push("NHIS number must be 8 digits (e.g., 57684276)")
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const errors = validateForm()
    if (errors.length > 0) {
      errors.forEach(error => toast.error(error))
      return
    }

    setIsSubmitting(true)

    try {
      // Generate folder number only when actually saving
      const finalFolderNumber = await generateFolderNumber()
      const now = new Date().toISOString()
      const patient = {
        id: generateId(),
        folderNumber: finalFolderNumber,
        name: formData.name.trim(),
        nhisNumber: formData.hasNHIS ? formData.nhisNumber.trim() : undefined,
        hasNHIS: formData.hasNHIS,
        age: parseInt(formData.age),
        sex: formData.sex as "male" | "female",
        region: formData.region,
        community: formData.community.trim(),
        locality: `${formData.community}, ${formData.region}`,
        phone: formData.phone.trim(),
        createdAt: now,
        updatedAt: now,
      }

      await patientDB.save(patient)
      
      // Proactively trigger cloud sync if online
      if (syncToCloud) {
        syncToCloud().catch((err: unknown) => console.error("Immediate sync failed:", err))
      }
      
      toast.success(`Patient ${formData.name} registered successfully!`, {
        description: `Folder: ${finalFolderNumber}`
      })
      
      // Reset form
      setFormData({
        name: "",
        nhisNumber: "",
        hasNHIS: true,
        age: "",
        sex: "",
        region: "",
        community: "",
        phone: "",
      })
      setIsPreview(true)

      // Redirect to patient ledger
      setTimeout(() => {
        router.push("/patients")
      }, 1500)

    } catch (error) {
      console.error("Registration error:", error)
      toast.error("Failed to register patient. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="bg-emerald-50 border-b border-emerald-100">
          <CardTitle className="text-emerald-800 flex items-center gap-2">
            New Patient Registration
            <span className="text-xs bg-emerald-600 text-white px-2 py-1 rounded-full">
              GHS
            </span>
            {folderNumber && (
              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full ml-auto">
                Folder: {folderNumber}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter patient's full name"
                  className="w-full"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nhisNumber">
                  NHIS Number {formData.hasNHIS && <span className="text-red-500">*</span>}
                </Label>
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    id="hasNHIS"
                    checked={formData.hasNHIS}
                    onChange={(e) => handleInputChange("hasNHIS", e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="hasNHIS" className="text-sm text-gray-700">
                    Patient has NHIS insurance
                  </Label>
                </div>
                <Input
                  id="nhisNumber"
                  type="text"
                  value={formData.nhisNumber}
                  onChange={(e) => handleInputChange("nhisNumber", e.target.value)}
                  placeholder="e.g., 57684276"
                  maxLength={8}
                  className="w-full font-mono"
                  required={formData.hasNHIS}
                  disabled={!formData.hasNHIS}
                />
                <p className="text-xs text-slate-500">
                  8-digit NHIS number (e.g., 57684276)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">
                  Age <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => handleInputChange("age", e.target.value)}
                  placeholder="Enter age in years"
                  min="0"
                  max="120"
                  className="w-full"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sex">
                  Gender <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.sex} onValueChange={(value) => handleInputChange("sex", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="Enter phone number (optional)"
                  className="w-full"
                />
              </div>
            </div>

            {/* Locality Information */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Locality Information</h3>
              <LocalitySelector
                value={{ region: formData.region, community: formData.community }}
                onChange={handleLocalityChange}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/patients")}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin mr-2"></div>
                    Registering...
                  </>
                ) : (
                  "Register Patient"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
