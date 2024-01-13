import Koa from 'koa';
import Router from '@koa/router';
import fs from 'fs/promises'


export const assetsRouter = new Router();

assetsRouter.get('/assets/styles.css', async (ctx) => {
  ctx.set('content-type', 'text/css')
  ctx.body = await fs.readFile('./src/assets/styles.css')
});
assetsRouter.get('/assets/alpine.js', async (ctx) => {
  ctx.set('content-type', 'application/javascript')
  ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
  ctx.body = await fs.readFile('./src/assets/alpine.js')
});
assetsRouter.get('/assets/serviceworker.js', async (ctx) => {
  ctx.set('content-type', 'application/javascript')
  ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
  ctx.set('Service-Worker-Allowed', '/') //@see https://w3c.github.io/ServiceWorker/#service-worker-allowed
  ctx.body = await fs.readFile('./src/assets/serviceworker.js')
});
assetsRouter.get('/manifest.json', async (ctx) => {
  ctx.set('content-type', 'application/json')
  ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
  ctx.body = await fs.readFile('./src/assets/manifest.json')
});
assetsRouter.get('/assets/:img', async (ctx) => {
  const img = ctx.params.img
  console.log({ img })
  if (/icon-\d+x\d+\.(png|ico)/.test(img)) {
    ctx.set('content-type', 'image/png')
    ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
    const image = await fs.readFile('./src/assets/' + img).catch(() => undefined)
    if (image) ctx.body = image
  }
});