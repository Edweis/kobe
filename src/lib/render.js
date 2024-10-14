import fs from 'node:fs';
import Handlebars from 'handlebars';
import glob from 'fast-glob'
import { toCurrency } from './helpers.js';
import dayjs from 'dayjs';
const root = './src'

// Helpers
Handlebars.registerHelper('default', function (arg1, arg2, options) {
  return arg1 || arg2
})
Handlebars.registerHelper('eq', (arg1, arg2) => arg1 === arg2);
Handlebars.registerHelper('formatTime', (arg1, arg2) => dayjs(arg1).format(arg2));
Handlebars.registerHelper('lt', (arg1, arg2) => arg1 < arg2);
Handlebars.registerHelper('gt', (arg1, arg2) => arg1 > arg2);
Handlebars.registerHelper('stringify', function (arg1) {
  return JSON.stringify(arg1)
});
Handlebars.registerHelper('empty', function (arg1) {
  return (arg1||[]).length === 0
});
Handlebars.registerHelper('trim-time', function (arg1) {
  return arg1 && new Date(arg1).toISOString().slice(0, 16)
});
Handlebars.registerHelper('currency', function (arg1, arg2) {
  return toCurrency(arg2, arg1)
});

// Partials
const partialPath = root + '/views/partials/'
const files = await glob(partialPath + '**/*.hbs')
files.forEach(file => {
  const name = file.replace(partialPath, '').replace('.hbs', '')
  Handlebars.registerPartial(name, fs.readFileSync(file).toString());
})


export function render(template, parameters) {
  let file = fs.readFileSync(root + '/views/' + template + '.hbs').toString()
  if (file == null) throw Error('File not found ' + template)
  return Handlebars.compile(file)(parameters);
}
