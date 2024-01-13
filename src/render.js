import fs from 'node:fs';
import Handlebars from 'handlebars';
import dayjs from 'dayjs'

const root = './src'

// Helpers
Handlebars.registerHelper('currency', function (arg1, options) {
  return Intl.NumberFormat(undefined, { style: 'currency', currency: arg1, }).format(options.fn(this))
})
Handlebars.registerHelper('date', function (arg1, options) {
  return dayjs(options.fn(this)).format(arg1)
})
Handlebars.registerHelper('json', function (arg1, options) {
  return JSON.stringify(arg1)
})
Handlebars.registerHelper('parse', function (arg1, options) {
  return JSON.parse(arg1)
})
Handlebars.registerHelper('ifEq', function (arg1, arg2, options) {
  return arg1 === arg2 ? options.fn(this) : options.inverse(this)
})
Handlebars.registerHelper('default', function (arg1, arg2, options) {
  return arg1 || arg2
})
Handlebars.registerHelper('ifDefined', function (arg1, options) {
  return arg1 != null ? options.fn(this) : options.inverse(this)
})

// Partials
const partialPath = root + '/views/partials/body.hbs'
Handlebars.registerPartial('body', fs.readFileSync(partialPath).toString());



const matchBlock = (name) => new RegExp(`{{#block ${name}}}\n*([\\s\\S]*?)\s*{{\/block}}`, 'g')
export function render(template, parameters) {
  const [fileName, block] = template.split('?');
  let file = fs.readFileSync(root + '/views/' + fileName + '.hbs').toString()

  if (block) file = matchBlock(block).exec(file)?.[1]
  if (file == null) throw Error('File not found ' + template)
  return Handlebars.compile(file)(parameters);
}

