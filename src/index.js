import Koa from 'koa';
import Router from '@koa/router';
import { render } from './lib/render.js';
import fs from 'fs/promises'
import bodyParser from 'koa-bodyparser'
import db from './lib/db.js';
const app = new Koa();
const router = new Router();

// Middlewares
app
  .use(bodyParser())
  .use(async (ctx, next) => {
    console.log(ctx.method, ctx.path)
    try {
      await next()
    } catch (error) {
      console.error(error)
      ctx.status = 500
      ctx.body = { ...error, message: error.message }
    }
  })


// Helpers
const insertLine = (l) => db.run(`
  INSERT OR REPLACE INTO lines (created_at, name, amount, currency, paid, split, project_id, id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, 
  [l.created_at, l.name, l.amount, l.currency, l.paid, JSON.stringify(l.split), l.project_id, l.id])

const insertProject = (p) => db.run(`
  INSERT OR REPLACE INTO projects (id, name, participants, currency)
  VALUES ($1, $2, $3, $4)`,
  [p.id, p.name, JSON.stringify(p.participants), p.currency]
)


// Endpoints
router.get('/', async (ctx) => {
  ctx.body = render('main')
});

router.post('/data.json', async (ctx) => {
  const pending = ctx.request.body;
  const promises = [
    ...pending.lines.map(insertLine),
    ...pending.projects.map(insertProject),
  ]
  await Promise.all(promises)

  let projects = await db.all('SELECT * FROM projects')
  projects = projects.map(p => ({ ...p, participants: JSON.parse(p.participants) }))
  let lines = await db.all('SELECT * FROM lines ORDER BY created_at DESC')
  lines = lines.map(l => ({ ...l, split: JSON.parse(l.split) }))

  await new Promise(res => setTimeout(res, 5000))
  ctx.body = { projects, lines }
});


//assets
router.get('/assets/styles.css', async (ctx) => {
  ctx.set('content-type', 'text/css')
  ctx.body = await fs.readFile('./src/assets/styles.css')
});
router.get('/assets/alpine.js', async (ctx) => {
  ctx.set('content-type', 'application/javascript')
  // ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
  ctx.body = await fs.readFile('./src/assets/alpine.js')
});
router.get('/assets/serviceworker.js', async (ctx) => {
  ctx.set('content-type', 'application/javascript')
  ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
  ctx.set('Service-Worker-Allowed', '/') //@see https://w3c.github.io/ServiceWorker/#service-worker-allowed
  ctx.body = await fs.readFile('./src/assets/serviceworker.js')
});
router.get('/manifest.json', async (ctx) => {
  ctx.set('content-type', 'application/json')
  ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
  ctx.body = await fs.readFile('./src/assets/manifest.json')
});
router.get('/assets/:img', async (ctx) => {
  const img = ctx.params.img
  console.log({ img })
  if (/icon-\d+x\d+\.(png|ico)/.test(img)) {
    ctx.set('content-type', 'image/png')
    ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
    const image = await fs.readFile('./src/assets/' + img).catch(() => undefined)
    if (image) ctx.body = image
  }
});

app
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(8745, () => console.log('Open: http://localhost:8745'));