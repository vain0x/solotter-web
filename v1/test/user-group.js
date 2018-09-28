const { UserGroupPathFormat } = require("../models/user-group");
const assert = require("assert");

describe("UserGroupPathFormat", function () {
  describe("parse", function () {
    it("can parse", function () {
      const defaultScreenName = "default";
      const table =
        [
          {
            source: "_followers",
            target: { type: "followers", ownerScreenName: defaultScreenName, slug: "_followers" },
          },
          {
            source: "list-001",
            target: { type: "list", ownerScreenName: defaultScreenName, slug: "list-001" },
          },
          {
            source: "@vain0x/_followers",
            target: { type: "followers", ownerScreenName: "vain0x", slug: "_followers" },
          },
          {
            source: "@vain0x/_friends",
            target: { type: "friends", ownerScreenName: "vain0x", slug: "_friends" },
          },
          {
            source: "@vain_zero/my-list",
            target: { type: "list", ownerScreenName: "vain_zero", slug: "my-list" },
          },
        ];

      for (const testCase of table) {
        assert.deepStrictEqual(testCase.target, UserGroupPathFormat.parse(testCase.source, defaultScreenName));
      }
    });
  });
});
