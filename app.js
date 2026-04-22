const express = require('express');
const path = require('path');

const app = express();
const indexRouter = require('./routes/index');

app.disable('x-powered-by');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const isProd = process.env.NODE_ENV === 'production';

// Bootstrap e Cytoscape locais (via node_modules)
app.use(
  '/vendor/bootstrap',
  express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist'), {
    maxAge: isProd ? '7d' : 0,
    immutable: isProd,
  })
);

app.use(
  '/vendor/cytoscape',
  express.static(path.join(__dirname, 'node_modules', 'cytoscape', 'dist'), {
    maxAge: isProd ? '7d' : 0,
    immutable: isProd,
  })
);

// Font Awesome local (via node_modules)
app.use(
  '/vendor/fontawesome',
  express.static(path.join(__dirname, 'node_modules', '@fortawesome', 'fontawesome-free'), {
    maxAge: isProd ? '7d' : 0,
    immutable: isProd,
  })
);

// Servir arquivos estáticos da pasta public (dentro da pasta Projeto)
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProd ? '7d' : 0,
    immutable: isProd,
  })
);

// Middleware para passar a URL atual para todas as views
app.use((req, res, next) => {
  res.locals.url = req.path;
  next();
});

app.use('/', indexRouter);

// Handler de erro (500)
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);

  const showStack = process.env.NODE_ENV !== 'production';
  res.status(500).render('server-error', {
    errorMessage: err && err.message ? err.message : undefined,
    errorStack: err && err.stack ? err.stack : undefined,
    showStack,
  });
});

app.use((req, res) => {
  res.status(404).render('not-found');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST;
const logUrl = HOST ? `http://${HOST}:${PORT}` : `http://localhost:${PORT}`;

const onListen = () => {
  console.log(`Servidor rodando em ${logUrl}`);
};

if (HOST) {
  app.listen(PORT, HOST, onListen);
} else {
  app.listen(PORT, onListen);
}
