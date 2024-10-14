import assert from 'node:assert';
export function randKey(prefix, length = 8) {
  const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let res = '';
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * keys.length);
    res += keys.charAt(index);
  }
  return prefix + res;
}

const round = (number) => Math.round(number * 1000) / 1000
export function computeBalance(balanceMap) {
  // validate balance
  let total = 0;
  balanceMap.forEach(value => total += value);
  assert(total < 0.01, 'Balance is not balanced: ' + total)

  let highest = { diff: -Infinity }
  let lowest = { diff: Infinity }
  balanceMap.forEach((diff, name) => {
    if (diff == 0) return // No expense for the participant.
    if (highest.diff < diff) highest = { name, diff }
    if (diff < lowest.diff) lowest = { name, diff }
  })

  if (highest.name === lowest.name) return []

  const amount = Math.min(Math.abs(highest.diff), Math.abs(lowest.diff))
  balanceMap.set(lowest.name, round(lowest.diff + amount))
  balanceMap.set(highest.name, round(highest.diff - amount))
  const tx = { from: lowest.name, to: highest.name, amount: round(amount) }
  return [tx, ...computeBalance(balanceMap)]
}



const CURR_MAX_DEC = { "IDR": 0, "BIF": 0, "CLP": 0, "DJF": 0, "GNF": 0, "ISK": 0, "JPY": 0, "KMF": 0, "KRW": 0, "PYG": 0, "RWF": 0, "UGX": 0, "UYI": 0, "VND": 0, "VUV": 0, "XAF": 0, "XOF": 0, "XPF": 0, "BHD": 3, "IQD": 3, "JOD": 3, "KWD": 3, "LYD": 3, "OMR": 3, "TND": 3, "CLF": 4, "UYW": 4 }
export function toCurrency(curr, amount) {
  const digits = CURR_MAX_DEC[curr] ?? 2
  return Intl
    .NumberFormat(undefined, { style: 'currency', currency: curr || 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(amount)
}


import fs from 'fs'
export const sendStatic = (filePath) => async (ctx,) => {
  const stats = fs.statSync(filePath)
  if (filePath.endsWith('.css')) ctx.set('content-type', 'text/css')
  if (filePath.endsWith('.js')) ctx.set('content-type', 'application/javascript')
  if (filePath.endsWith('.jpg')) ctx.set('content-type', 'image/jpeg')
  if (filePath.endsWith('.png')) ctx.set('content-type', 'image/png')

  if (filePath.endsWith('.js')) ctx.set('cache-control', 'max-age=31536000, immutable')
  ctx.set('etag', new Date(stats.mtime).toISOString());
  ctx.body = fs.createReadStream(filePath)
}


export const formatEtag = (str) => {
  if (str == null || str.startsWith('W')) return str;
  return 'W/' + str
};
