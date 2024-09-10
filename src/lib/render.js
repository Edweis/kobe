import fs from 'node:fs';
import Handlebars from 'handlebars';
import dayjs from 'dayjs'
import glob from 'fast-glob'
const root = './src'


// Helpers
Handlebars.registerHelper('default', function (arg1, arg2, options) {
  return arg1 || arg2
})
Handlebars.registerHelper('gt', function (arg1, arg2) {
  console.log({arg2, arg1})
  return arg1> arg2
});

// Partials
const partialPath = root + '/views/partials/'
const files = await glob(partialPath+'**/*.hbs')
files.forEach(file =>{
  const name = file.replace(partialPath, '').replace('.hbs', '')
  Handlebars.registerPartial(name, fs.readFileSync(file).toString());
})


export function render(template, parameters) {
  let file = fs.readFileSync(root + '/views/' + template + '.hbs').toString()

  if (file == null) throw Error('File not found ' + template)
  return Handlebars.compile(file)(parameters);
}

