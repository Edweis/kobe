import Koa from 'koa';
import Router from '@koa/router';
import { render } from './lib/render.js';
import fs from 'fs/promises'
import bodyParser from 'koa-bodyparser'
import logger from 'koa-logger'
import db from './lib/db.js';
import { randKey, sendStatic, shortDate, toCurrency } from './lib/helpers.js';
const app = new Koa();
const router = new Router();

// Middlewares
app
  .use(logger())
  .use(bodyParser())
  .use(async (ctx, next) => {
    await next();
    const ifMod = ctx.request.header['if-modified-since'];
    const lastMod = ctx.response.header['last-modified']
    if (ifMod && ifMod === lastMod)
      ctx.status = 304
  })



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
const SIZE = 20;
router.get('/projects/:id', async (ctx) => {
  if (!ctx.path.endsWith('/')) return ctx.redirect(ctx.path + '/')
  const q = ctx.query.q || null
  const page = Number(ctx.query.page) || 1
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.id])
  if (project == null) return ctx.redirect('/');

  // Cache by last modified date
  let latest = await db.get('SELECT updated_at FROM lines WHERE project_id=$1 ORDER BY updated_at DESC LIMIT 1', [ctx.params.id])
  ctx.set('last-modified', new Date(latest.updated_at).toUTCString())

  project.participants = JSON.parse(project.participants)
  const me = ctx.cookies.get('me') ?? project.participants[0]
  let lines = await db.all(`
    SELECT l.*, s.amount as myAmount FROM lines l
    LEFT JOIN split s ON s.project_id=$projectId AND s.line_id=l.id AND s.participant=$me
    WHERE l.project_id=$projectId AND deleted_at IS NULL AND (l.name LIKE $q OR $q is NULL)
    ORDER BY created_at DESC
    LIMIT $limit OFFSET $offset
  `, {
    $projectId: ctx.params.id,
    $me: me,
    $q: q && `%${q}%`,
    $limit: SIZE,
    $offset: (page - 1) * SIZE
  });

  lines = lines.map(line => {
    const myImpact = (line.paid === me) ? line.amount - line.myAmount : -line.myAmount
    return {
      ...line,
      created_at: shortDate(line.created_at),
      paidBy: (line.paid === me ? 'You' : line.paid) + ' paid ' + toCurrency(line.currency, line.amount),
      myImpactStr: toCurrency(line.currency, myImpact),
      myImpact
    }
  })
  ctx.body = render('project', { project, lines, q, nextPage: page + 1 })
});
router.get('/projects/:id/manifest.json', async (ctx) => {
  const imgSizes = [48, 72, 96, 128, 144, 152, 192, 384, 512,]
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.id])
  ctx.body = {
    "$schema": "https://json.schemastore.org/web-manifest-combined.json",
    "name": project.name,
    "short_name": project.name,
    "start_url": "/projects/" + ctx.params.id,
    "display": "standalone",
    "background_color": "#121c22",
    "description": "Organise group expenses on the web.",
    "icons": imgSizes.map(s => ({ "src": `/assets/icon-${s}x${s}.png`, "sizes": `${s}x${s}`, "type": "image/png", "purpose": "maskable any" })),
    "protocol_handlers": [{ "protocol": "web+over", "url": "/kobe?type=%s" }]
  }
})
router.get('/projects/:projectId/lines/:lineId', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.projectId])
  let line = await db.get('SELECT * FROM lines WHERE project_id=$1 AND id=$2', [ctx.params.projectId, ctx.params.lineId])
  let split = await db.all('SELECT * from split WHERE project_id=$1 AND line_id=$2', [ctx.params.projectId, ctx.params.lineId])
  ctx.set('last-modified', new Date(line.updated_at).toUTCString())

  project.participants = JSON.parse(project.participants);

  const perfectSplit = line.amount / split.filter(s => s.amount > 0).length
  const isEqually = split.every(({ amount }) => amount - perfectSplit <= 0.1 || amount === 0)
  const method = isEqually ? 'equally' : 'amount'
  ctx.body = render('project-line', { project, line, split, method })
});
router.get('/projects/:projectId/add-line/', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.projectId])
  project.participants = JSON.parse(project.participants)

  const now = new Date().toISOString().split('.')[0]
  const me = ctx.cookies.get('me')
  ctx.body = render('project-line', {
    project,
    line: { created_at: now, currenct: project.currency, paid: me },
    split: project.participants.map(p => ({ participant: p, amount: 0 })),
    me
  })
});
router.delete('/projects/:projectId/lines/:lineId', async (ctx) => {
  const { projectId, lineId } = ctx.params
  const now = new Date().toISOString()
  await db.get(`
    UPDATE lines 
    SET deleted_at=$1, updated_at=$1 
    WHERE project_id=$2 AND id=$3`,
    [now, projectId, lineId])
  ctx.status = 204
  return ctx.set('HX-Redirect', `/projects/${projectId}/`)
})
router.post('/projects/:projectId/lines', async (ctx) => {
  const line = ctx.request.body
  const { projectId } = ctx.params
  const now = new Date().toISOString()
  line.id = line.id || randKey('lin_')
  line.created_at = line.created_at ?? now
  line.amount = Number(line.amount)
  line.split = (line.split || []).map(s => ({ ...s, amount: Number(s.amount ?? 0) }))

  const totalSplit = line.split.reduce((acc, val) => acc + val.amount, 0)
  ctx.assert(totalSplit === Number(line.amount), 400, `Balance is off: ${totalSplit} vs ${line.amount}`)


  await db.run(`
    INSERT INTO lines (id, project_id, name, amount, paid, updated_at, created_at)
    VALUES            ($1,         $2,   $3,     $4,   $5,         $6,         $7)
    ON CONFLICT(id, project_id) DO UPDATE SET 
      name=$3, amount=$4, paid=$5, updated_at=$6, created_at=$7`,
    [line.id, projectId, line.name, line.amount, line.paid, now, line.created_at])
  const promises = line.split.map(async ({ participant, amount }) => db.run(`
      INSERT INTO split (participant, amount, project_id, line_id)
      VALUES            (         $1,     $2,          $3,     $4)
      ON CONFLICT(participant, line_id, project_id) DO UPDATE SET 
        amount=$2`,
    [participant, amount, projectId, line.id])
  )
  await Promise.all(promises)
  const nextLine = await db.get('SELECT * FROM lines WHERE project_id=$1 AND id=$2', [ctx.params.projectId, line.id])


  ctx.status = 201
  return ctx.set('HX-Redirect', `/projects/${projectId}/`)
})



router.get('/projects/:id/balance', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.id])
  let allSpent = await db.all(`
    SELECT s.participant, sum(s.amount) as total 
    FROM split s
    JOIN lines l ON l.id = s.line_id AND l.project_id = s.project_id
    WHERE s.project_id=$1 AND l.deleted_at IS NULL
    GROUP BY s.participant`, [ctx.params.id])
  let allPaid = await db.all(`
    SELECT paid as participant, sum(amount) as total 
    FROM lines
    WHERE project_id=$1 AND deleted_at IS NULL
    GROUP BY paid`, [ctx.params.id])

  const balance = JSON.parse(project.participants).map(participant => {
    const spent = allSpent.find(s => s.participant === participant)?.total ?? 0
    const paid = allPaid.find(s => s.participant === participant)?.total ?? 0
    const diff = paid - spent
    return { participant, spent, paid, diff }
  })
  // const max = spent.reduce((acc, val) => Math.max(acc, (val.total)), 0)
  ctx.body = render('balance', { project, balance })
});

router.get('/projects/:id/settings/', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.id])
  project.participants = JSON.parse(project.participants)
  const me = ctx.cookies.get('me')
  ctx.body = render('settings', { project, me })
})

router.delete('/projects/:id/participant/:name', async (ctx) => {
  let project = await db.get('SELECT participants FROM projects WHERE id=$1', [ctx.params.id])
  project.participants = JSON.parse(project.participants).filter(p => p !== ctx.params.name)
  const nextParticipants = JSON.stringify(project.participants)
  await db.run(`UPDATE projects SET participants=$1 WHERE id=$2`, [nextParticipants, ctx.params.id])
  ctx.status = 201
})
router.post('/projects/:id/participant', async (ctx) => {
  const name = ctx.header['hx-prompt'].trim()
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.id])
  project.participants = JSON.parse(project.participants)
    .filter(p => p !== name)
    .concat(name)
    .sort()
  const nextParticipants = JSON.stringify(project.participants)
  await db.run(`UPDATE projects SET participants=$1 WHERE id=$2`, [nextParticipants, ctx.params.id])
  ctx.body = render('settings', { project })
})
router.put('/projects/:id/me', async (ctx) => {
  ctx.cookies.set('me', ctx.request.body.me)
  ctx.status = 201
})



//assets
router.get('/assets/styles.css', sendStatic('./src/assets/styles.css'));
router.get('/assets/alpine.js', sendStatic('./src/assets/alpine.js'));
router.get('/assets/htmx.js', sendStatic('./src/assets/htmx.js'));
router.get('/assets/ah-card.jpg', sendStatic('./src/assets/ah-card.jpg'));
router.get('/assets/:img', async (ctx) => {
  const img = ctx.params.img
  if (/icon-\d+x\d+\.(png|ico)/.test(img))
    return sendStatic('./src/assets/' + img)(ctx)
});

app
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(8745, () => console.log('Open: http://localhost:8745'));