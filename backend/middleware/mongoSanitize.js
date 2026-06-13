const hasUnsafeMongoKey = (value, path = "body") => {
  if (!value || typeof value !== "object") return null;

  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      return `${path}.${key}`;
    }

    const unsafePath = hasUnsafeMongoKey(child, `${path}.${key}`);
    if (unsafePath) return unsafePath;
  }

  return null;
};

const mongoSanitize = (req, res, next) => {
  for (const source of ["body", "params", "query"]) {
    const unsafePath = hasUnsafeMongoKey(req[source], source);
    if (unsafePath) {
      return res.status(400).json({
        success: false,
        message: `Invalid request key: ${unsafePath}`
      });
    }
  }

  return next();
};

module.exports = mongoSanitize;
