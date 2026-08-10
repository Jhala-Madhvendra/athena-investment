const pino = require("pino");
const env = require("../config/env");

const logger = pino({
    level: process.env.LOG_LEVEL || (env.nodeEnv === "test" ? "silent" : env.isProduction ? "info" : "debug"),
    ...(env.isProduction || env.nodeEnv === "test"
        ? {}
        : {
              transport: {
                  target: "pino-pretty",
                  options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
              },
          }),
});

module.exports = logger;
