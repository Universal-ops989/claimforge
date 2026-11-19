/**
 * A phone number as the API keeps it (`+15125550142`, `+15125550142;ext=204`) the way
 * people read it: "(512) 555-0142", "(512) 555-0142 ext. 204". North American numbers
 * are written out; any other is shown as kept.
 */
export function displayPhone(phone: string): string {
  const [number = "", ext] = phone.split(";ext=");
  const nanp = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(number);
  const shown = nanp ? `(${nanp[1] ?? ""}) ${nanp[2] ?? ""}-${nanp[3] ?? ""}` : number;
  return ext ? `${shown} ext. ${ext}` : shown;
}

/** The `tel:` link for a phone number as the API keeps it. */
export function telLink(phone: string): string {
  return `tel:${phone.replace(";ext=", ",")}`;
}
