import fs from 'node:fs';
import Handlebars from 'handlebars';
import dayjs from 'dayjs'
import glob from 'fast-glob'
const root = './src'

const CURR_MAX_DEC = {"IDR":0,"BIF":0,"CLP":0,"DJF":0,"GNF":0,"ISK":0,"JPY":0,"KMF":0,"KRW":0,"PYG":0,"RWF":0,"UGX":0,"UYI":0,"VND":0,"VUV":0,"XAF":0,"XOF":0,"XPF":0,"BHD":3,"IQD":3,"JOD":3,"KWD":3,"LYD":3,"OMR":3,"TND":3,"CLF":4,"UYW":4}

// Helpers
// Handlebars.registerHelper('currency', function (arg1, arg2) {
//   const digits = CURR_MAX_DEC[arg1]??2
//   console.log('XXXX', {arg1, arg2})
//   return Intl
//     .NumberFormat(undefined, { style: 'currency', currency: arg1, minimumFractionDigits:digits, maximumFractionDigits:digits})
//     .format(arg2)
// })
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
Handlebars.registerHelper('ifNeg', function (arg1,  options) {
  return arg1 < 0 ? options.fn(this) : options.inverse(this)
})
Handlebars.registerHelper('default', function (arg1, arg2, options) {
  return arg1 || arg2
})
Handlebars.registerHelper('ifDefined', function (arg1, options) {
  return arg1 != null ? options.fn(this) : options.inverse(this)
})

// Partials
const partialPath = root + '/views/partials/'
const files = await glob(partialPath+'**/*.hbs')
files.forEach(file =>{
  const name = file.replace(partialPath, '').replace('.hbs', '')
  Handlebars.registerPartial(name, fs.readFileSync(file).toString());
})



const matchBlock = (name) => new RegExp(`{{#block ${name}}}\n*([\\s\\S]*?)\s*{{\/block}}`, 'g')
export function render(template, parameters) {
  const [fileName, block] = template.split('?');
  let file = fs.readFileSync(root + '/views/' + fileName + '.hbs').toString()

  if (block) file = matchBlock(block).exec(file)?.[1]
  if (file == null) throw Error('File not found ' + template)
  return Handlebars.compile(file)(parameters);
}

