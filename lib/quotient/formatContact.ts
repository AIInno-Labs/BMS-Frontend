export function formatQuotientContact(
  contact: Record<string, unknown> | null | undefined
): string {
  if (!contact) return "";
  const first = String(contact.name_first ?? "").trim();
  const last = String(contact.name_last ?? "").trim();
  const name = [first, last].filter(Boolean).join(" ");
  if (name) return name;
  const email = String(contact.email ?? "").trim();
  if (email) return email;
  return String(contact.company_name ?? "").trim();
}
