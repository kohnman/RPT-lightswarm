/**
 * PM2 Ecosystem Configuration
 * For production deployment on Raspberry Pi
 */

module.exports = {
  apps: [{
    name: 'lightswarm-middleware',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    env_development: {
      NODE_ENV: 'development'
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    restart_delay: 3000,
    exp_backoff_restart_delay: 100
  }]
};
