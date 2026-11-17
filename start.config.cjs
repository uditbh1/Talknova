module.exports = {
  apps: [
    {
      name: "talknova-ai",
      script: "./server.js",
      cwd: "/home/developer/apps/talknova.ai",
      watch: false,
      autorestart: true,
      exec_mode: "cluster",
      interpreter: "/home/developer/.nvm/versions/node/v22.14.0/bin/node",
      error_file: "/dev/null",
      out_file: "/dev/null",
      merge_logs: true,
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        RUNTIME_ENV: process.env.RUNTIME_ENV || "production",
        PORT: 3025,
      },
    },
  ],
};
