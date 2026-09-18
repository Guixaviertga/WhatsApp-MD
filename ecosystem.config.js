module.exports = {
  apps: [
    {
      name: 'whatsapp-md',
      script: 'index.js',
      autorestart: true,
      watch: false,
      max_restarts: 10,
    },
  ],
};
