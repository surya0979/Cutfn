export const KG_PER_LB = 0.45359237
export const KM_PER_MI = 1.609344

export const lbToKg = (lb) => lb * KG_PER_LB
export const kgToLb = (kg) => kg / KG_PER_LB
export const miToKm = (mi) => mi * KM_PER_MI
export const kmToMi = (km) => km / KM_PER_MI

export const toKg = (value, unit) => (unit === 'lb' ? lbToKg(value) : value)
export const fromKg = (kg, unit) => (unit === 'lb' ? kgToLb(kg) : kg)
export const toKm = (value, unit) => (unit === 'mi' ? miToKm(value) : value)
export const fromKm = (km, unit) => (unit === 'mi' ? kmToMi(km) : km)

export function round(value, digits = 0) {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

const intFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
export const fmtInt = (n) => intFormat.format(Math.round(n))
export const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1)
