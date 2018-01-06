const express = require("express");
const router = express.Router();
const TwitterService = require("../models/twitter-service");

router.get("/", (req, res, _next) => {
  res.render("tweet", {
    title: "Tweet",
    twitterUser: {
      screenName: "@vain0x",
      displayName: "vain0x"
    },
    status: req.query.status,
    errorMessage: req.query.error_message,
  });
});

router.post("/create", (req, res, _next) => {
  if (req.body.password !== "solotter") {
    res.sendStatus(403);
    return;
  }

  const content = req.body.tweet_content;
  const twitterService = new TwitterService();

  twitterService.postTweet(content).then(
    _ => {
      res.redirect("/tweet?status=success");
    },
    error => {
      console.error(error);
      res.redirect("/tweet?status=error");
    });
});

module.exports = router;
