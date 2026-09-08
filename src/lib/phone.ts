/** Normalise a Nigerian phone number to digits in 234XXXXXXXXXX form. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  let n = digits;
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("0")) n = "234" + n.slice(1);
  if (n.length === 10) n = "234" + n;
  if (!/^234\d{10}$/.test(n)) return null;
  return n;
}

export function displayPhone(phone: string): string {
  if (/^234\d{10}$/.test(phone)) return "0" + phone.slice(3);
  return phone;
}

/** Synthetic credentials so customers can sign in with just phone + 4-digit PIN. */
export function credentialsFor(phone: string, pin: string) {
  return {
    email: `${phone}@tadikkoriders.app`,
    password: `tdk!${phone}#${pin}`,
  };
}

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
}

export function naira(amount: number | string) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}
