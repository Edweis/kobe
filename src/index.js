import Koa from 'koa';
import Router from '@koa/router';
import { render } from './render.js';
import fs from 'fs'

const app = new Koa();
const router = new Router();

const lines = [
  {
    id: "spe_2",
    createdAt: "2024-01-03",
    name: "Grab",
    amount: "133024",
    currency: "IDR",
    paid: "francois",
    split: [
      { for: "francois", amount: "66512" },
      { for: "kaille", amount: "66512" }
    ]
  },
  {
    id: "spe_3",
    createdAt: "2024-01-02",
    name: "Beers",
    amount: "429762",
    currency: "IDR",
    paid: "francois",
    split: [
      { for: "francois", amount: "66512" },
      { for: "kaille", amount: "66512" }
    ]
  },
  {
    id: "spe_4",
    createdAt: "2024-01-01",
    name: "Weekend camille",
    amount: "170730",
    currency: "IDR",
    paid: "kaille",
    split: [
      { for: "francois", amount: "66512" },
      { for: "kaille", amount: "66512" }
    ]
  }
]
const projects = [
  { id: "pro_123", name: "Suka makan", participants: ["francois", "kaille"] }
]
const currencies = ["IDR", "SGD", "EUR", "USD"]

router.get('/', (ctx) => {
  ctx.body = render('index',)
});
router.get('/styles.css', (ctx) => {
  ctx.set( 'content-type', 'text/css')
  ctx.body = fs.readFileSync('./src/styles.css')
});
router.get('/alpine.js', (ctx) => {
  ctx.set( 'content-type', 'application/javascript')
  ctx.body = fs.readFileSync('./src/lib/alpine.js')
});

router.get('/project/:projectId', (ctx) => {
  const project = projects.find(p => p.id === ctx.params.projectId);
  if (project) ctx.body = render('project', { project, lines })
});

router.get('/project/:projectId/line/:lineId', (ctx) => {
  const project = projects.find(p => p.id === ctx.params.projectId);
  const line = lines.find(l => l.id === ctx.params.lineId)
  if (project && line) {
    ctx.body = render('project-line', { project, line, currencies })
  }
});

app
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(8745, () => console.log('Open: http://localhost:8745'));