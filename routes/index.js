
const express = require('express');
const router = express.Router();
const documentacaoRouter = require('./documentacao');

// Visualização principal
router.get('/', (req, res) => {
  res.render('dsu');
});

// Página de referências e podcast
router.get('/referencias', (req, res) => {
  res.render('referencias');
});

router.use('/documentacao', documentacaoRouter);

router.get('/sobre', (req, res) => {
  res.render('sobre');
});

module.exports = router;
