import Koa from 'koa';
import Router from '@koa/router';
import fs from 'fs/promises'


export const assetsRouter = new Router();

assetsRouter.get('/styles.css', async (ctx) => {
  ctx.set('content-type', 'text/css')
  ctx.body = await fs.readFile('./src/assets/styles.css')
});
assetsRouter.get('/alpine.js', async (ctx) => {
  ctx.set('content-type', 'application/javascript')
  ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
  ctx.body = await fs.readFile('./src/assets/alpine.js')
});
assetsRouter.get('/:img', async (ctx) => {
  const img = ctx.params.img
  console.log({ img })
  if (/icon-\d+x\d+\.(png|ico)/.test(img)) {
    ctx.set('content-type', 'image/png')
    ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
    const image = await fs.readFile('./src/assets/' + img).catch(() => undefined)
    if (image) ctx.body = image
  }
});