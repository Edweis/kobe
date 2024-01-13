export function randKey(length=8){
  const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let res = '';
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * keys.length);
    res += keys.charAt(index);
  }
  return res;
}
