const getPagination = (query = {}, defaults = {}) => {
  const defaultLimit = defaults.defaultLimit || 20;
  const maxLimit = defaults.maxLimit || 100;
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

const getPaginationMeta = (total, page, limit) => ({
  page,
  pages: Math.ceil(total / limit),
  total
});

module.exports = { getPagination, getPaginationMeta };
