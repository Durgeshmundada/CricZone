const formatIssues = (issues) => issues.map((issue) => ({
  path: issue.path.join("."),
  message: issue.message
}));

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Request validation failed",
      errors: formatIssues(result.error.issues)
    });
  }

  if (result.data.body !== undefined) req.body = result.data.body;
  if (result.data.params !== undefined) req.params = result.data.params;
  if (result.data.query !== undefined) req.query = result.data.query;

  return next();
};

module.exports = validate;
