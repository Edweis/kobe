const arrayToCsv = (row, del = ',') =>
  row
    .map((r) => (r ?? '').toString().replace(/"/g, '""'))
    .map((r) => (r.includes('\n') || r.includes(`"`) || r.includes(del) ? `"${r}"` : r))
    .join(del);
export const jsonToCsv = ( listObj, config ) => {
  if (listObj.length === 0) return '';
  const del = config?.del || ',';

  // Compute header keys
  const keySet = new Set();
  listObj.forEach((obj) => Object.keys(obj).forEach((key) => keySet.add(key)));
  let keys = [...keySet];
  if (config?.keepEmptyColumns !== true)
    keys = keys.filter(
      (key) => listObj.some((obj) => obj[key] != null), // remove empty columns
    );

  const lines = listObj
    .map((obj) => keys.map((key) => obj[key])) // reorder and fill missing keys
    .map((values) => arrayToCsv(values), del);
  if (config?.withHeaders === false) return lines.join('\n');

  const headers = arrayToCsv([...keys], del);
  return [headers, ...lines].join('\n');
};
