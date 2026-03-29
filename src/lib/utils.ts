// Helpers de formateo y utilidades

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatMoney0(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function getCurrentYear(): string {
  return new Date().getFullYear().toString()
}

export function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}
