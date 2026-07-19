"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Official 16 regions of Ghana (2024)
const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North"
] as const;

// Official 10 provinces of Zimbabwe
const ZIMBABWE_PROVINCES = [
  "Bulawayo",
  "Harare",
  "Manicaland",
  "Mashonaland Central",
  "Mashonaland East",
  "Mashonaland West",
  "Masvingo",
  "Matabeleland North",
  "Matabeleland South",
  "Midlands"
] as const;

interface LocalitySelectorProps {
  value: {
    region: string;
    community: string;
  };
  onChange: (value: { region: string; community: string }) => void;
  className?: string;
  countryCode?: string; // "GH" for Ghana, "ZW" for Zimbabwe
}

export function LocalitySelector({ value, onChange, className, countryCode = "GH" }: LocalitySelectorProps) {
  // Select regions based on country code
  const regions = countryCode?.toUpperCase() === "ZW" ? ZIMBABWE_PROVINCES : GHANA_REGIONS;
  const regionLabel = countryCode?.toUpperCase() === "ZW" ? "Province" : "Region";

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Region/Province Selection */}
      <div className="space-y-2">
        <Label htmlFor="region" className="text-sm font-medium text-slate-700">
          {regionLabel} <span className="text-red-500">*</span>
        </Label>
        <Select
          value={value.region}
          onValueChange={(region) => onChange({ ...value, region })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={`Select ${regionLabel.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Community/Town Input */}
      <div className="space-y-2">
        <Label htmlFor="community" className="text-sm font-medium text-slate-700">
          Community/Town <span className="text-red-500">*</span>
        </Label>
        <Input
          id="community"
          type="text"
          value={value.community}
          onChange={(e) => onChange({ ...value, community: e.target.value })}
          placeholder="Enter town or community name"
          className="w-full"
        />
        <p className="text-xs text-slate-500">
          Specify the town or community where patient resides
        </p>
      </div>
    </div>
  )
}

// Export regions for use in other components
export { GHANA_REGIONS, ZIMBABWE_PROVINCES }
