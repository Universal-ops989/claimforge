/** The parts of an address, as the API sends them or the form holds them. */
export interface AddressParts {
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postal_code?: string | null;
}

/**
 * An address as it's written on an envelope: the street, then "City, Region Postal".
 * Parts left out (or blank) leave no stray commas or spaces.
 */
export function addressLines(address: AddressParts): string {
  const street = [address.line1, address.line2].filter(Boolean).join(", ");
  const place = [address.region, address.postal_code].filter(Boolean).join(" ");
  const town = [address.city, place].filter(Boolean).join(", ");
  return [street, town].filter(Boolean).join("\n");
}
