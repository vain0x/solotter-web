var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, _next) {
  req.session.visitCount = (req.session.visitCount || 0) + 1;

  res.render('index', {
    title: 'Express',
    visitCount: req.session.visitCount,
  });
});

module.exports = router;
