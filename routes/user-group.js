const express = require("express");
const auth = require("./auth");
const tweet = require("./tweet");
const { UserGroupPathFormat } = require("../models/user-group");

const router = express.Router();

router.all("*", auth.requireAuthMiddleware);

router.get("/", (request, response, _next) => {
  response.render("user-group-index", {
    title: "User Group Management",
    _csrf: request.csrfToken(),
  });
});

const fetchEdit = async (slug, tus) => {
  let source = undefined;
  if (slug !== undefined) {
    source = await tus.exportUserGroup(slug);
  }

  return {
    title: "Edit User Group",
    slug: slug,
    userGroupPathPattern: UserGroupPathFormat.regexpPattern,
    source: source || "",
  };
};

router.get("/edit", async (request, response, next) => {
  try {
    const slug = request.query.slug || "";
    const tus = tweet.createTwitterUserService(request);
    const bag = await fetchEdit(slug, tus);

    response.render("user-group-edit", {
      title: bag.title,
      status: "",
      bag,
      _csrf: request.csrfToken(),
    });
  } catch (ex) {
    next(ex);
  }
});

router.post("/edit", async (request, response, next) => {
  try {
    const slug = request.body.slug || undefined;
    const source = request.body.source || undefined;

    if (slug === undefined || source === undefined) {
      return next("Invalid request.");
    }

    const tus = tweet.createTwitterUserService(request);

    try {
      await tus.importUserGroup(slug, source);
    } catch (ex) {
      next(ex);
      return;
    }

    const bag = await fetchEdit(slug, tus);
    response.render("user-group-edit", {
      title: "Edit User Group",
      status: "success",
      bag,
      _csrf: request.csrfToken(),
    });
  } catch (ex) {
    next(ex);
  }
});

router.get("/all", async (request, response, _next) => {
  const tus = tweet.createTwitterUserService(request);
  const userGroups = await tus.allUserGroups();

  response.render("user-group-all", {
    title: "Owned User Groups",
    userGroups:
      userGroups.map(userGroup => ({ path: userGroup.path, slug: userGroup.userGroupKey.slug })),
    _csrf: request.csrfToken(),
  });
});

module.exports = {
  userGroupRouter: router,
};
