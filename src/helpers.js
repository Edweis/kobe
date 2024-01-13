export function randKey(prefix, length = 8) {
  const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let res = '';
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * keys.length);
    res += keys.charAt(index);
  }
  return prefix + res;
}

function rebalance(expenses) {
  console.log(expenses)
  let highest = { amount: -Infinity }
  let lowest = { amount: Infinity }
  expenses.forEach((amount, name) => {
    if(amount==0) return
    if (highest.amount < amount) highest = { name, amount }
    if (amount < lowest.amount) lowest = { name, amount }
  })
  if(highest.name===lowest.name) return []

  expenses.delete(lowest.name);
  expenses.set(highest.name, highest.amount + lowest.amount)
  const tx = {from: lowest.name, to: highest.name, amount: -lowest.amount}
  return [tx, ...rebalance(expenses)]
}

export function computeBalance(lines) {
  const expenses = new Map()
  lines
    .flatMap(l => JSON.parse(l.split).map(ll => ({ ...ll, paid: l.paid })))
    .forEach(({ participant, amount, paid }) => {
      expenses.set(paid, (expenses.get(paid) || 0) + Number(amount))
      expenses.set(participant, (expenses.get(participant) || 0) - Number(amount))
    });

  return rebalance(expenses)
}