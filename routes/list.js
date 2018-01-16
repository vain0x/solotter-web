const express = require("express");
const auth = require("./auth");
const tweet = require("./tweet");

const router = express.Router();

router.all("*", auth.requireAuthMiddleware);

router.get("/", (request, response, _next) => {
  response.render("list-index", {
    title: "List Management",
    _csrf: request.csrfToken(),
  });
});

const fetchEdit = async (slug, tus) => {
  let source = undefined;
  if (slug !== undefined) {
    source = await tus.exportList(slug);
  }

  return {
    title: "Edit List",
    slug: slug,
    source: source || "",
  };
};

router.get("/edit", async (request, response, next) => {
  try {
    const slug = request.query.slug || undefined;
    const tus = tweet.createTwitterUserService(request);
    const bag = await fetchEdit(slug, tus);

    response.render("list-edit", {
      title: bag.title,
      status: "",
      bag,
      _csrf: request.csrfToken(),
    });
  } catch (ex) {
    console.error(ex);
    next(ex);
  }
});

router.post("/edit", async (request, response, next) => {
  try {
    const slug = request.body.slug || undefined;
    const source = request.body.source || undefined;

    if (slug === undefined || source === undefined) {
      throw new Error();
    }

    const tus = tweet.createTwitterUserService(request);

    try {
      await tus.importList(slug, source);
    } catch (ex) {
      console.error(ex);
      response.header("Content-type", "text/plain");
      response.write("ERROR!");
      return;
    }

    const bag = await fetchEdit(slug, tus);
    response.render("list-edit", {
      title: "Edit List",
      status: "success",
      bag,
      _csrf: request.csrfToken(),
    });
  } catch (ex) {
    console.error(ex);
    next(ex);
  }
});

router.get("/show/all", async (request, response, _next) => {
  const tus = tweet.createTwitterUserService(request);
  const lists = await tus.lists();

  response.render("list-index", {
    title: "Your Lists",
    lists,
    _csrf: request.csrfToken(),
  });
});

module.exports = {
  listRouter: router,
};
