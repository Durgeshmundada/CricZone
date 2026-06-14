module.exports = async () => {
  if (global.__CRICZONE_MONGO_SERVER__) {
    await global.__CRICZONE_MONGO_SERVER__.stop();
  }
};
