module.exports = {
  apps: [
    {
      name: "hp102",
      script: "node_modules/.bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3102",
      },
    },
  ],
};
