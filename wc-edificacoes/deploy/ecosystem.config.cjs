// PM2 — pm2 start deploy/ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'wc-edificacoes',
    cwd: __dirname + '/../server',
    script: 'src/server.js',
    instances: 1,            // rate limit em memória: mantenha 1 instância (ou use Redis)
    max_memory_restart: '400M',
    env: { NODE_ENV: 'production' },
  }],
};
