const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('docs/doc');
});

router.get('/dsu-sem-otimizacoes', (req, res) => {
  res.render('docs/doc-dsu');
});

router.get('/union-by-size-path-compression', (req, res) => {
  res.render('docs/doc-union-by-size');
});

router.get('/union-by-rank-path-compression', (req, res) => {
  res.render('docs/doc-union-by-rank');
});

module.exports = router;
