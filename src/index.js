import Handlebars from 'handlebars';
import Koa from 'koa';
import Router from '@koa/router';
import { render } from './lib/render.js';
import fs from 'fs/promises'
import bodyParser from 'koa-bodyparser'
import logger from 'koa-logger'
import db from './lib/db.js';
import { randKey, sendStatic, shortDate, toCurrency, formatEtag } from './lib/helpers.js';
import dayjs from 'dayjs';
const app = new Koa();
const router = new Router();

// Middlewares
app
  .use(logger())
  .use(bodyParser())
  .use(async (ctx, next) => {
    await next();

    const ifMatch = ctx.request.header['if-none-match'];
    const etag = formatEtag(ctx.response.header['etag'])
    if (etag) ctx.set('etag', etag) // updated formated etag
    if (etag && ifMatch === etag)
      ctx.status = 304
  })

router.param('projectId', async (projectId, ctx, next) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [projectId])
  if (project == null) return ctx.redirect('/');
  project.participants = JSON.parse(project.participants)
  ctx.state.project = project;
  ctx.state.me = ctx.cookies.get(projectId + ':me') ?? project.participants[0]
  ctx.state.me = ctx.state.me && ctx.state.me.replace('Ã§', 'ç')
  return next()
})

// Endpoints
router.get('/', async (ctx) => {
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
    [id, name, '[]', 'EUR']
  )
  return ctx.redirect('/projects/' + id)
})
const SIZE = 20;
router.get('/projects/:projectId', async (ctx) => {
  if (!ctx.path.endsWith('/')) return ctx.redirect(ctx.path + '/')
  const q = ctx.query.q || null
  const page = Number(ctx.query.page) || 1
  const project = ctx.state.project

  // Cache by last modified date
  let latest = await db.get('SELECT updated_at FROM lines WHERE project_id=$1 ORDER BY updated_at DESC LIMIT 1', [project.id])
  if (latest) ctx.set('etag', JSON.stringify(latest.updated_at + '#' + ctx.state.me))

  const me = ctx.state.me
  let lines = await db.all(`
    SELECT l.*, s.amount as myAmount FROM lines l
    LEFT JOIN split s ON s.project_id=$projectId AND s.line_id=l.id AND s.participant=$me
    WHERE l.project_id=$projectId AND deleted_at IS NULL AND (l.name LIKE $q OR $q is NULL)
    ORDER BY created_at DESC
    LIMIT $limit OFFSET $offset
  `, {
    $projectId: project.id,
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
  ctx.body = render('project', { project: ctx.state.project, lines, q, nextPage: page + 1 })
});
router.get('/projects/:projectId/autocomplete', async ctx => {
  const response = await db.all(
    `SELECT DISTINCT TRIM(name) as name FROM lines
    WHERE project_id=?
      AND name LIKE ?
      AND deleted_at IS NULL
    LIMIT 10`,
    [ctx.params.projectId, '%' + ctx.query.name + '%']
  )
  const options = response.map(r => r.name)
  console.log(options)
  const template = Handlebars.compile(/*html*/`{{#each options}}<option value="{{this}}"></option>{{/each}}`)
  ctx.body = template({ options })
})
router.get('/projects/:projectId/manifest.json', async (ctx) => {
  const imgSizes = [48, 72, 96, 128, 144, 152, 192, 384, 512,]
  const project = ctx.state.project
  ctx.body = {
    "$schema": "https://json.schemastore.org/web-manifest-combined.json",
    "name": project.name,
    "short_name": project.name,
    "start_url": "/projects/" + project.id,
    "display": "standalone",
    "background_color": "#121c22",
    "description": "Organise group expenses on the web.",
    "icons": imgSizes.map(s => ({ "src": `/assets/icon-${s}x${s}.png`, "sizes": `${s}x${s}`, "type": "image/png", "purpose": "maskable any" })),
    "protocol_handlers": [{ "protocol": "web+over", "url": "/kobe?type=%s" }]
  }
})
router.get('/projects/:projectId/lines/:lineId', async (ctx) => {
  let project = ctx.state.project
  let line = await db.get('SELECT * FROM lines WHERE project_id=$1 AND id=$2', [project.id, ctx.params.lineId])
  let split = await db.all('SELECT * from split WHERE project_id=$1 AND line_id=$2', [project.id, ctx.params.lineId])
  ctx.set('etag', JSON.stringify(line.updated_at + '#' + ctx.state.me))
  console.log(ctx.response.header)

  const perfectSplit = line.amount / split.filter(s => s.amount > 0).length
  const isEqually = split.every(({ amount }) => amount - perfectSplit <= 0.1 || amount === 0)
  const method = isEqually ? 'equally' : 'amount'
  ctx.body = render('project-line', { project, line, split, method })
});
router.get('/projects/:projectId/add-line/', async (ctx) => {
  const project = ctx.state.project
  const now = new Date().toISOString().split('.')[0]
  ctx.body = render('project-line', {
    project,
    line: { created_at: now, currenct: project.currency, paid: ctx.state.me },
    split: project.participants.map(p => ({ participant: p, amount: 0 })),
    me: ctx.state.me
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
  line.name = line.name.trim()
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


  ctx.status = 201
  return ctx.set('HX-Redirect', `/projects/${projectId}/`)
})



router.get('/projects/:projectId/balance', async (ctx) => {
  const project = ctx.state.project
  let allSpent = await db.all(`
    SELECT s.participant, sum(s.amount) as total
    FROM split s
    JOIN lines l ON l.id = s.line_id AND l.project_id = s.project_id
    WHERE s.project_id=$1 AND l.deleted_at IS NULL
    GROUP BY s.participant`, [ctx.params.projectId])
  let allPaid = await db.all(`
    SELECT paid as participant, sum(amount) as total
    FROM lines
    WHERE project_id=$1 AND deleted_at IS NULL
    GROUP BY paid`, [ctx.params.projectId])

  const balance = project.participants.map(participant => {
    const spent = allSpent.find(s => s.participant === participant)?.total ?? 0
    const paid = allPaid.find(s => s.participant === participant)?.total ?? 0
    const diff = paid - spent
    return { participant, spent, paid, diff }
  })
  // const max = spent.reduce((acc, val) => Math.max(acc, (val.total)), 0)
  ctx.body = render('balance', { project, balance })
});

router.get('/projects/:projectId/settings/', async (ctx) => {
  const project = ctx.state.project
  const me = ctx.state.me
  ctx.body = render('settings', { project, me })
})
router.delete('/projects/:projectId/participant/:name', async (ctx) => {
  const project = ctx.state.project
  project.participants = project.participants.filter(p => p !== ctx.params.name)
  await db.run(
    `UPDATE projects SET participants=$1 WHERE id=$2`,
    [JSON.stringify(project.participants), project.id]
  )
  ctx.status = 201
})
router.post('/projects/:projectId/participant', async (ctx) => {
  const name = ctx.header['hx-prompt'].trim()
  let project = ctx.state.project
  project.participants = project.participants
    .filter(p => p !== name)
    .concat(name)
    .sort()
  await db.run(
    `UPDATE projects SET participants=$1 WHERE id=$2`,
    [JSON.stringify(project.participants), project.id]
  )
  ctx.body = render('settings', { project })
})
router.put('/projects/:projectId/me', async (ctx) => {
  const projectId = ctx.params.projectId
  const expires = new dayjs().add(1, 'year').toDate()
  ctx.cookies.set(projectId + ':me', ctx.request.body.me, { sameSite: 'strict', expires })
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
