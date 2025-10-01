/**
 * Chilean-specific utilities for RUT validation, tax calculations, and formatting
 */

/**
 * Validates Chilean RUT (Rol Único Tributario)
 * @param rut - RUT string (can include dots and hyphens)
 * @returns boolean indicating if RUT is valid
 */
export function validateRUT(rut: string): boolean {
  // Remove dots and convert to uppercase
  const cleanRut = rut.replace(/\./g, '').replace('-', '').toUpperCase();
  
  // Check if RUT has correct format (7-8 digits + verification digit)
  if (!/^[0-9]{7,8}[0-9K]$/.test(cleanRut)) {
    return false;
  }

  const rutDigits = cleanRut.slice(0, -1);
  const verificationDigit = cleanRut.slice(-1);

  // Calculate verification digit
  let sum = 0;
  let multiplier = 2;

  // Iterate through digits from right to left
  for (let i = rutDigits.length - 1; i >= 0; i--) {
    sum += parseInt(rutDigits[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const calculatedDigit = remainder < 2 ? remainder : 11 - remainder;
  const expectedDigit = calculatedDigit === 10 ? 'K' : calculatedDigit.toString();

  return verificationDigit === expectedDigit;
}

/**
 * Formats RUT with dots and hyphen
 * @param rut - RUT string
 * @returns Formatted RUT (e.g., "12.345.678-9")
 */
export function formatRUT(rut: string): string {
  const cleanRut = rut.replace(/\./g, '').replace('-', '');
  if (cleanRut.length < 8) return rut;
  
  const digits = cleanRut.slice(0, -1);
  const verificationDigit = cleanRut.slice(-1);
  
  // Add dots every 3 digits from right to left
  const formattedDigits = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${formattedDigits}-${verificationDigit}`;
}

/**
 * Calculates Chilean IVA (19% tax)
 * @param amount - Base amount in CLP
 * @returns Object with net amount, tax amount, and total
 */
export function calculateIVA(amount: number): {
  netAmount: number;
  taxAmount: number;
  total: number;
} {
  const taxRate = 0.19; // 19% IVA
  const netAmount = Math.round(amount / (1 + taxRate));
  const taxAmount = amount - netAmount;
  
  return {
    netAmount,
    taxAmount,
    total: amount
  };
}

/**
 * Formats Chilean Peso (CLP) currency
 * @param amount - Amount in CLP
 * @returns Formatted currency string
 */
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Chilean timezone utilities
 */
export const CHILEAN_TIMEZONE = 'America/Santiago';

/**
 * Gets current time in Chilean timezone
 */
export function getChileanTime(): Date {
  return new Date(new Date().toLocaleString("en-US", {timeZone: CHILEAN_TIMEZONE}));
}

/**
 * Chilean tax configuration
 */
export const CHILEAN_TAX_CONFIG = {
  IVA_RATE: 0.19, // 19%
  CURRENCY: 'CLP',
  COUNTRY_CODE: 'CL',
  LOCALE: 'es-CL',
  TIMEZONE: 'America/Santiago'
} as const;
