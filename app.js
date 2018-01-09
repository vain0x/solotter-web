var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var csurf = require('csurf');
var bodyParser = require('body-parser');

var index = require('./routes/index');
const authRouter = require("./routes/auth");
const tweetRouter = require("./routes/tweet");

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(csurf({ cookie: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Add cookie-based session management middleware.
app.use(cookieSession({
  keys: [process.env.COOKIE_SESSION_SECRET],
  // 90 days
  maxAge: 90 * 24 * 60 * 60 * 1000,
  expires: new Date(2100, 1, 1),
}));

app.use('/', index);
app.use("/auth", authRouter);
app.use("/tweet", tweetRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
