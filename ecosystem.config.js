module.exports = {
  apps: [
    {
      name: 'whatsapp-md',
      script: 'src/index.js',
      autorestart: true,
      watch: false,
      max_restarts: 10,
    },
  ],
};
