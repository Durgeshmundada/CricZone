const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const createError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
};

const sendSuccess = (res, payload = {}, status = 200) =>
  res.status(status).json({
    success: true,
    ...payload
  });

module.exports = {
  asyncHandler,
  createError,
  sendSuccess
};
