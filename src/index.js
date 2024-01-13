import Koa from 'koa';
import Router from '@koa/router';
import { render } from './render.js';
import fs from 'fs'
import bodyParser from 'koa-bodyparser'
import db from './db.js';

const app = new Koa();
const router = new Router();

// Middlewares
app
  .use(bodyParser())
  .use((ctx, next)=>{
    console.log(ctx.method, ctx.path)
    return next()
  })

const currencies = ["IDR", "SGD", "EUR", "USD"]

// Statics
router.get('/styles.css', async (ctx) => {
  ctx.set('content-type', 'text/css')
  ctx.body = fs.readFileSync('./src/styles.css')
});
router.get('/alpine.js', async (ctx) => {
  ctx.set('content-type', 'application/javascript')
  ctx.body = fs.readFileSync('./src/lib/alpine.js')
});

// Endpoints
router.get('/', async (ctx) => {
  console.log('GET /')
  const projects = await db.all('SELECT * FROM projects')
  ctx.body = render('index', { projects })
});
router.get('/project/:projectId', async (ctx) => {
  const project = await db.get('SELECT * FROM projects WHERE id=$1', ctx.params.projectId)
  const lines = await db.all('SELECT * FROM lines WHERE project_id=$1', ctx.params.projectId)
  console.log(lines)
  if (project) ctx.body = render('project', { project, lines })
});
router.get('/project/:projectId/line/:lineId', async (ctx) => {
  let project = await db.get('SELECT * FROM projects WHERE id=$1', ctx.params.projectId)
  project = { ...project, participants: JSON.parse(project.participants) }
  const line = await db.get('SELECT * FROM lines WHERE project_id=$1 AND id=$2', ctx.params.projectId, ctx.params.lineId)
  if (project && line) {
    console.log(line)
    ctx.body = render('project-line', { project, line, currencies })
  }
});
router.post('/project/:projectId/line/:lineId', async (ctx) => {
  const body = ctx.request.body
  const params = [body.created_at, body.name, body.amount, body.currency, body.paid, JSON.stringify(body.split)]
  params.push(body.project_id, body.id) 
  console.log(params)
  await db.run(`UPDATE lines SET
                created_at=$1, name=$2, amount=$3, currency=$4, paid=$5, split=$6
                WHERE project_id=$7 AND id=$8`, params)
  ctx.redirect(ctx.URL)
});

app
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(8745, () => console.log('Open: http://localhost:8745'));