export function randKey(prefix, length = 8) {
  const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let res = '';
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * keys.length);
    res += keys.charAt(index);
  }
  return prefix + res;
}

export function computeBalance(expenses) {
  console.log(expenses)
  let highest = { amount: -Infinity }
  let lowest = { amount: Infinity }
  expenses.forEach((amount, name) => {
    if (amount == 0) return
    if (highest.amount < amount) highest = { name, amount }
    if (amount < lowest.amount) lowest = { name, amount }
  })
  if (highest.name === lowest.name) return []

  expenses.delete(lowest.name);
  expenses.set(highest.name, highest.amount + lowest.amount)
  const tx = { from: lowest.name, to: highest.name, amount: -lowest.amount }
  return [tx, ...computeBalance(expenses)]
}

export function computeExpenses(lines) {
  const expenses = new Map()
  lines
    .flatMap(l => JSON.parse(l.split).map(ll => ({ ...ll, paid: l.paid })))
    .forEach(({ participant, amount, paid }) => {
      expenses.set(paid, (expenses.get(paid) || 0) + Number(amount))
      expenses.set(participant, (expenses.get(participant) || 0) - Number(amount))
    });
  return expenses
}

const CURR_MAX_DEC = { "IDR": 0, "BIF": 0, "CLP": 0, "DJF": 0, "GNF": 0, "ISK": 0, "JPY": 0, "KMF": 0, "KRW": 0, "PYG": 0, "RWF": 0, "UGX": 0, "UYI": 0, "VND": 0, "VUV": 0, "XAF": 0, "XOF": 0, "XPF": 0, "BHD": 3, "IQD": 3, "JOD": 3, "KWD": 3, "LYD": 3, "OMR": 3, "TND": 3, "CLF": 4, "UYW": 4 }
export function toCurrency(curr, amount) {
  const digits = CURR_MAX_DEC[curr] ?? 2
  return Intl
    .NumberFormat(undefined, { style: 'currency', currency: curr || 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(amount)
}
export function shortDate(dateString) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const date = new Date(dateString);
  const day = date.getDate();
  const month = months[date.getMonth()];
  return `${day} ${month}`;
}

import fs from 'fs'
export const sendStatic = (filePath) => async (ctx, next) => {
  const stats = fs.statSync(filePath)
  if(filePath.endsWith('.css')) ctx.set('content-type', 'text/css')
  if(filePath.endsWith('.js')) ctx.set('content-type', 'application/javascript')
  if(filePath.endsWith('.jpg')) ctx.set('content-type', 'image/jpeg')
  ctx.set('last-modified', stats.mtime);
  ctx.body = fs.createReadStream(filePath)
}