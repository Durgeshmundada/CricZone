const { MongoMemoryServer } = require("mongodb-memory-server");

module.exports = async () => {
  const mongoServer = await MongoMemoryServer.create({
    instance: { dbName: "criczone_test" }
  });

  global.__CRICZONE_MONGO_SERVER__ = mongoServer;
  process.env.MONGO_URI = mongoServer.getUri("criczone_test");
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-only-jwt-secret-at-least-32-bytes";
  process.env.JWT_EXPIRE = "30m";
};
