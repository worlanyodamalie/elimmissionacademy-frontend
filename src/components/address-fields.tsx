"use client";

import { Field, Input, Select } from "./ui";
import type { Address } from "@/lib/types";

// The 16 official regions of Ghana (post-2018 reorganisation), alphabetised.
export const GHANA_REGIONS = [
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
  "Western North",
] as const;

export const EMPTY_ADDRESS: Address = {
  country: "Ghana",
  region: "",
  city: "",
  street: "",
  digitalAddress: "",
};

type Props = {
  value: Address;
  onChange: (next: Address) => void;
  idPrefix?: string;
  errors?: Partial<Record<keyof Address, string>>;
};

export function AddressFields({
  value,
  onChange,
  idPrefix = "addr",
  errors,
}: Props) {
  const set = (key: keyof Address, val: string) =>
    onChange({ ...value, [key]: val });

  const isGhana = value.country.trim().toLowerCase() === "ghana";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="Country"
        htmlFor={`${idPrefix}-country`}
        required
        error={errors?.country}
      >
        <Input
          id={`${idPrefix}-country`}
          value={value.country}
          onChange={(e) => set("country", e.target.value)}
          required
          autoComplete="country-name"
        />
      </Field>
      <Field
        label="Region"
        htmlFor={`${idPrefix}-region`}
        required
        error={errors?.region}
      >
        {isGhana ? (
          <Select
            id={`${idPrefix}-region`}
            value={value.region}
            onChange={(e) => set("region", e.target.value)}
            required
            invalid={!!errors?.region}
            aria-invalid={!!errors?.region || undefined}
          >
            <option value="" disabled>
              Select a region
            </option>
            {GHANA_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            id={`${idPrefix}-region`}
            value={value.region}
            onChange={(e) => set("region", e.target.value)}
            required
            autoComplete="address-level1"
            invalid={!!errors?.region}
            aria-invalid={!!errors?.region || undefined}
          />
        )}
      </Field>
      <Field
        label="City"
        htmlFor={`${idPrefix}-city`}
        required
        error={errors?.city}
      >
        <Input
          id={`${idPrefix}-city`}
          value={value.city}
          onChange={(e) => set("city", e.target.value)}
          required
          autoComplete="address-level2"
          invalid={!!errors?.city}
          aria-invalid={!!errors?.city || undefined}
        />
      </Field>
      <Field
        label="Street"
        htmlFor={`${idPrefix}-street`}
        required
        error={errors?.street}
      >
        <Input
          id={`${idPrefix}-street`}
          value={value.street}
          onChange={(e) => set("street", e.target.value)}
          required
          autoComplete="street-address"
          invalid={!!errors?.street}
          aria-invalid={!!errors?.street || undefined}
        />
      </Field>
      <Field
        label="Digital address"
        htmlFor={`${idPrefix}-digital`}
        hint="Optional. Ghana Post GPS or equivalent (e.g. GA-245-7890)"
        error={errors?.digitalAddress}
        className="sm:col-span-2"
      >
        <Input
          id={`${idPrefix}-digital`}
          value={value.digitalAddress}
          onChange={(e) => set("digitalAddress", e.target.value)}
        />
      </Field>
    </div>
  );
}
