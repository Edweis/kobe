import Koa from 'koa';
import Router from '@koa/router';
import { render } from './lib/render.js';
import fs from 'fs'
import bodyParser from 'koa-bodyparser'
import db from './lib/db.js';
import { computeBalance, computeExpenses, randKey } from './lib/helpers.js'
import dayjs from 'dayjs';
import { assetsRouter } from './static.js';
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
      ctx.status = 500
      ctx.body = { ...error, message: error.message }
    }
  })

const currencies = ["EUR", "IDR", "SGD", "USD"]

// Statics
router.use( assetsRouter.routes());

// Endpoints
router.get('/', async (ctx) => {
  const projects = await db.all('SELECT * FROM projects')
  ctx.body = render('index', { projects })
});

router.post('/project', async (ctx) => {
  const name = ctx.request.body.name
  if (name.trim() === '') return;

  const projectId = randKey('pro_')
  await db.run(`
    INSERT INTO projects (id, name, participants, currency)
    VALUES ($1, $2, $3, $4)`,
    [projectId, name, '[]', 'EUR']
  )
  ctx.redirect(`/project/${projectId}/settings`)
});

router.post('/project/:projectId/participant', async (ctx) => {
  const name = ctx.request.body.participant
  const projectId = ctx.params.projectId

  if (name.trim() !== '') {
    const project = await db.get('SELECT participants FROM projects WHERE id=$1', projectId)
    const nextParts = JSON.parse(project.participants).filter(p => p !== name).concat(name)
    await db.run(
      `UPDATE projects SET participants=$1 WHERE id=$2`,
      [JSON.stringify(nextParts), projectId]
    )
  }
  ctx.redirect(`/project/${projectId}/settings`)
});

router.get('/project/:projectId', async (ctx) => {
  const search = ctx.query.q
  const project = await db.get('SELECT * FROM projects WHERE id=$1', ctx.params.projectId)
  const lines = await db.all(`
    SELECT * FROM lines 
    WHERE project_id=$1 AND ($2 IS NULL OR name LIKE '%'||$2||'%')
    ORDER BY created_at DESC`,
    ctx.params.projectId, search)
  console.log(lines)
  const nextId = randKey('lin_')
  if (project) ctx.body = render('project', { project, lines, nextId, search })
  else ctx.redirect('/')
});

router.get('/project/:projectId/line/:lineId', async (ctx) => {
  const { projectId, lineId } = ctx.params
  let project = await db.get('SELECT * FROM projects WHERE id=$1', projectId)
  project = { ...project, participants: JSON.parse(project.participants) }

  let line = await db.get('SELECT * FROM lines WHERE project_id=$1 AND id=$2', projectId, lineId)
  if (line == null) line = { id: lineId, created_at: dayjs().format('YYYY-MM-DDTHH:mm'), currency: project.currency }
  console.log(line)
  if (project)
    ctx.body = render('project-line', { project, line, currencies })
});

router.post('/project/:projectId/line/:lineId', async (ctx) => {
  const body = ctx.request.body
  const params = [body.created_at, body.name, body.amount, body.currency, body.paid, JSON.stringify(body.split)]
  params.push(body.project_id, body.id)
  console.log(params)
  await db.run(`
    INSERT OR REPLACE INTO lines (created_at, name, amount, currency, paid, split, project_id, id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
    , params)
  ctx.redirect('/project/' + ctx.params.projectId)
});

router.post('/project/:projectId/line/:lineId/delete', async (ctx) => {
  await db.run(`DELETE FROM lines WHERE project_id=$1 AND id=$2`, [ctx.params.projectId, ctx.params.lineId])
  ctx.redirect('/project/' + ctx.params.projectId)
});

router.get('/project/:projectId/reim', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', ctx.params.projectId)
  project = { ...project, participants: JSON.parse(project.participants) }
  let lines = await db.all('SELECT paid, split FROM lines WHERE project_id=$1', ctx.params.projectId)

  const expenses = computeExpenses(lines)
  const balance = computeBalance(expenses)
  ctx.body = render('project-reim', { project, balance })
});
router.get('/project/:projectId/balance', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', ctx.params.projectId)
  project = { ...project, participants: JSON.parse(project.participants) }
  let lines = await db.all('SELECT paid, split FROM lines WHERE project_id=$1', ctx.params.projectId)

  const expenses = computeExpenses(lines)
  ctx.body = render('project-balance', { project, expenses })
});

router.get('/project/:projectId/settings', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', ctx.params.projectId)
  project = { ...project, participants: JSON.parse(project.participants) }
  ctx.body = render('project-settings', { project, currencies })
});

router.post('/project/:projectId/settings', async (ctx) => {
  const projectId = ctx.params.projectId;
  const currency = ctx.request.body.currency;
  await db.run('UPDATE projects SET currency=$1 WHERE id=$2', currency, projectId)
  ctx.redirect(`/project/${projectId}/settings`)
});


app
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(8745, () => console.log('Open: http://localhost:8745'));