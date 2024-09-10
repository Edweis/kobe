import Koa from 'koa';
import Router from '@koa/router';
import { render } from './lib/render.js';
import fs from 'fs/promises'
import bodyParser from 'koa-bodyparser'
import logger from 'koa-logger'
import db from './lib/db.js';
import { randKey, shortDate, toCurrency } from './lib/helpers.js';
const app = new Koa();
const router = new Router();

// Middlewares
app
  .use(logger())
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
  INSERT OR REPLACE INTO lines (created_at, name, amount, currency, paid, split, project_id, id, deleted_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  [l.created_at, l.name, l.amount, l.currency, l.paid, JSON.stringify(l.split), l.project_id, l.id, l.deleted_at || null])

const insertProject = (p) => db.run(`
  INSERT OR REPLACE INTO projects (id, name, participants, currency)
  VALUES ($1, $2, $3, $4)`,
  [p.id, p.name, JSON.stringify(p.participants), p.currency]
)


// Endpoints
router.get('/', async (ctx) => {
  // ctx.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=5');
  let projects = await db.all('SELECT id, name FROM projects')
  ctx.body = render('list-projects', { projects })
});

router.post('/projects', async ctx => {
  const name = ctx.header['hx-prompt'];
  if (!name) return ctx.throw(204)
  const id = randKey('pro_')
  await db.run(`
    INSERT OR REPLACE INTO projects (id, name, participants, currency)
    VALUES ($1, $2, $3, $4)`,
    [id, name, [], 'EUR']
  )
  return ctx.redirect('/projects/' + id)
})
router.get('/projects/:id', async (ctx) => {
  if (!ctx.path.endsWith('/')) return ctx.redirect(ctx.path + '/')
  const q = ctx.query.q
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.id])
  let lines = await db.all(`
    SELECT * FROM lines 
    WHERE project_id=$1 AND deleted_at IS NULL AND ($2 IS NULL OR name LIKE $2)
    ORDER BY created_at DESC
  `, [ctx.params.id, q ? `%${q}%` : null])
  project.participants = JSON.parse(project.participants)
  const me = project.participants[0]
  lines = lines.map(line => {
    const split = JSON.parse(line.split)
    const mySplit = split.find(s => s.participant === me)?.amount || 0
    const myImpact = (line.paid === me) ? line.amount - mySplit : -mySplit

    return {
      ...line,
      split,
      created_at: shortDate(line.created_at),
      paidBy: (line.paid === me ? 'You' : line.paid) + ' paid ' + toCurrency(line.currency, line.amount),
      myImpactStr: toCurrency(line.currency, myImpact),
      myImpact
    }
  })
  ctx.body = render('project', { project, lines, q })
});
router.get('/projects/:projectId/lines/:lineId', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.projectId])
  let line = await db.get('SELECT * FROM lines WHERE project_id=$1 AND id=$2', [ctx.params.projectId, ctx.params.lineId])
  project.participants = JSON.parse(project.participants)
  line.split = JSON.parse(line.split)

  ctx.body = render('project-line', { project, line })
});
router.delete('/projects/:projectId/lines/:lineId', async (ctx) => {
  const { projectId, lineId } = ctx.params
  await db.get('UPDATE lines  SET deleted_at = datetime(\'now\') WHERE project_id=$1 AND id=$2', [projectId, lineId])
  ctx.status = 204
  return ctx.set('HX-Redirect', '/projects/' + projectId + '/')
})

router.get('/data.json', async (ctx) => {
  let projects = await db.all('SELECT * FROM projects')
  projects = projects.map(p => ({ ...p, participants: JSON.parse(p.participants) }))
  let lines = await db.all('SELECT * FROM lines WHERE deleted_at IS NULL ORDER BY created_at DESC')
  lines = lines.map(l => ({ ...l, split: JSON.parse(l.split) }))

  ctx.body = { projects, lines }
});

router.post('/data.json', async (ctx) => {
  const pending = ctx.request.body;
  const promises = [
    ...pending.lines.map(insertLine),
    ...pending.projects.map(insertProject),
  ]
  await Promise.all(promises)
  ctx.redirect('/data.json')
});


//assets
router.get('/assets/styles.css', async (ctx) => {
  ctx.set('content-type', 'text/css')
  ctx.body = await fs.readFile('./src/assets/styles.css')
});
router.get('/assets/alpine.js', async (ctx) => {
  ctx.set('content-type', 'application/javascript')
  ctx.set('Cache-Control', 'public, max-age=31536000')
  ctx.body = await fs.readFile('./src/assets/alpine.js')
});
router.get('/assets/htmx.js', async (ctx) => {
  ctx.set('content-type', 'application/javascript')
  ctx.set('Cache-Control', 'public, max-age=31536000')
  ctx.body = await fs.readFile('./src/assets/htmx.js')
});


router.get('/manifest.json', async (ctx) => {
  ctx.set('content-type', 'application/json')
  ctx.body = await fs.readFile('./src/assets/manifest.json')
});
router.get('/assets/ah-card.jpg', async (ctx) => {
  ctx.set('content-type', 'image/jpeg')
  ctx.set('Cache-Control', 'public, max-age=31536000')
  ctx.body = await fs.readFile('./src/assets/ah-card.jpg')
});
router.get('/assets/:img', async (ctx) => {
  const img = ctx.params.img
  if (/icon-\d+x\d+\.(png|ico)/.test(img)) {
    ctx.set('content-type', 'image/png')
    ctx.set('Cache-Control', 'public, max-age=31536000')
    const image = await fs.readFile('./src/assets/' + img).catch(() => undefined)
    if (image) ctx.body = image
  }
});

app
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(8745, () => console.log('Open: http://localhost:8745'));