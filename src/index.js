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
// .use(async (ctx, next) => {
//   console.log(ctx.method, ctx.path)
//   try {
//     await next()
//   } catch (error) {
//     console.error(error, Object.keys(error))
//     ctx.body = error.message
//   }
// })



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
  const q = ctx.query.q || null
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.id])
  project.participants = JSON.parse(project.participants)
  const me = project.participants[0]
  let lines = await db.all(`
    SELECT l.*, s.amount as myAmount FROM lines l
    LEFT JOIN split s ON s.project_id=$1 AND s.line_id=l.id AND s.participant=$2
    WHERE l.project_id=$1 AND deleted_at IS NULL AND (l.name LIKE $3 OR $3 is NULL)
    ORDER BY created_at DESC
  `, [ctx.params.id, me, q && `%${q}%`]);

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
  ctx.body = render('project', { project, lines, q })
});
router.get('/projects/:projectId/lines/:lineId', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.projectId])
  let line = await db.get('SELECT * FROM lines WHERE project_id=$1 AND id=$2', [ctx.params.projectId, ctx.params.lineId])
  let split = await db.all('SELECT * from split WHERE project_id=$1 AND line_id=$2', [ctx.params.projectId, ctx.params.lineId])

  project.participants = JSON.parse(project.participants)
  ctx.body = render('project-line', { project, line, split })
});
router.get('/projects/:projectId/add-line/', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.projectId])
  project.participants = JSON.parse(project.participants)

  const now = new Date().toISOString().split('.')[0]
  ctx.body = render('project-line', {
    project,
    line: { created_at: now, currenct: project.currency },
    split: project.participants.map(p => ({ participant: p, amount: 0 }))
  })
});
router.delete('/projects/:projectId/lines/:lineId', async (ctx) => {
  const { projectId, lineId } = ctx.params
  await db.get('UPDATE lines  SET deleted_at = datetime(\'now\') WHERE project_id=$1 AND id=$2', [projectId, lineId])
  ctx.status = 204
  return ctx.set('HX-Redirect', `/projects/${projectId}/`)
})
router.post('/projects/:projectId/lines', async (ctx) => {
  const line = ctx.request.body
  const { projectId } = ctx.params
  const now = new Date().toISOString()
  line.id = line.id || randKey('lin_')
  line.amount = Number(line.amount)
  line.split = (line.split || []).map(s => ({ ...s, amount: Number(s.amount ?? 0) }))

  const totalSplit = line.split.reduce((acc, val) => acc + val.amount, 0)
  ctx.assert(totalSplit === Number(line.amount), 400, `Balance is off: ${totalSplit} vs ${line.amount}`)

  await db.run(`
    INSERT INTO lines (id, project_id, name, amount, paid, updated_at, created_at)
    VALUES            ($1,         $2,   $3,     $4,   $5,         $6,         $6)
    ON CONFLICT(id, project_id) DO UPDATE SET 
      name=$3, amount=$4, paid=$5, updated_at=$6`,
    [line.id, projectId, line.name, line.amount, line.paid, now])
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
  project.participants=JSON.parse(project.participants)
  console.log(project)
  ctx.body = render('settings', { project })
})

router.delete('/projects/:id/participant/:name', async (ctx) => {
  let project = await db.get('SELECT participants FROM projects WHERE id=$1', [ctx.params.id])
  project.participants = JSON.parse(project.participants).filter(p => p !== ctx.params.name)
  const nextParticipants = JSON.stringify(project.participants)
  await db.run(`UPDATE projects SET participants=$1 WHERE id=$2`, [nextParticipants, ctx.params.id])
  ctx.status = 201  
})
router.post('/projects/:id/participant', async (ctx) => {
  const name = ctx.header['hx-prompt']
  let project = await db.get('SELECT * FROM projects WHERE id=$1', [ctx.params.id])
  project.participants = JSON.parse(project.participants)
    .filter(p => p !== name)
    .concat(name)
    .sort()
  const nextParticipants = JSON.stringify(project.participants)
  await db.run(`UPDATE projects SET participants=$1 WHERE id=$2`, [nextParticipants, ctx.params.id])
  ctx.body = render('settings', { project })
})



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