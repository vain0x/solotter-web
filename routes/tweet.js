const express = require("express");
const auth = require("./auth");
const { TwitterAppService } = require("../models/twitter-service");

const router = express.Router();
const twitterAppService = new TwitterAppService();

const createTwitterUserService = req => {
  return twitterAppService.userService(req.session.twitter.accessToken);
};

router.all("*", auth.requireAuthMiddleware);

router.get("/", (req, res, _next) => {
  const screenName = req.session.twitter.user.screenName;

  res.render("tweet", {
    title: "Tweet | Solotter",
    twitterUser: {
      screenName: `@${screenName}`
    },
    status: req.query.status,
    errorMessage: req.query.error_message,
    csrfToken: req.csrfToken(),
  });
});

router.post("/post-tweet", (req, res, _next) => {
  const twitterUserService = createTwitterUserService(req);

  const content = req.body.tweet_content;

  twitterUserService.postTweet(content).then(
    _ => {
      res.redirect("/tweet?status=success");
    },
    error => {
      console.error(error);
      res.redirect("/tweet?status=error");
    });
});

module.exports = router;
