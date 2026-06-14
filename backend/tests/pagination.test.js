const { getPagination, getPaginationMeta } = require("../utils/pagination");

describe("pagination helpers", () => {
  test("clamps page and limit values", () => {
    expect(getPagination({ page: "0", limit: "500" })).toEqual({
      page: 1,
      limit: 100,
      skip: 0
    });
  });

  test("calculates page metadata", () => {
    expect(getPaginationMeta(41, 2, 20)).toEqual({
      page: 2,
      pages: 3,
      total: 41
    });
  });
});
