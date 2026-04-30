module.exports = {
  apps: [
    {
      name: "sec-monitor",
      // Entrada: monitora SEC 192.168.1.191 + camera LPR 192.168.1.164
      script: "C:/Users/pcmet/Documents/license_plater_recog/venv/Scripts/python.exe",
      args:   "C:/Users/pcmet/Documents/license_plater_recog/sec_monitor.py",
      interpreter: "none",

      cwd: "C:/Users/pcmet/Documents/license_plater_recog",
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 3000,
      exp_backoff_restart_delay: 5000,
      max_memory_restart: "500M",

      error_file: "C:/Users/pcmet/Documents/license_plater_recog/logs/pm2-error.log",
      out_file:   "C:/Users/pcmet/Documents/license_plater_recog/logs/pm2-out.log",
      log_file:   "C:/Users/pcmet/Documents/license_plater_recog/logs/pm2-combined.log",
      time: true,
      env: { NODE_ENV: "production" }
    },
    {
      name: "exit-monitor",
      // Saída: monitora SEC 192.168.0.192 + camera 192.168.1.182
      script: "C:/Users/pcmet/Documents/license_plater_recog/venv/Scripts/python.exe",
      args:   "C:/Users/pcmet/Documents/license_plater_recog/exit_monitor.py",
      interpreter: "none",

      cwd: "C:/Users/pcmet/Documents/license_plater_recog",
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 3000,
      exp_backoff_restart_delay: 5000,
      max_memory_restart: "500M",

      error_file: "C:/Users/pcmet/Documents/license_plater_recog/logs/pm2-exit-error.log",
      out_file:   "C:/Users/pcmet/Documents/license_plater_recog/logs/pm2-exit-out.log",
      log_file:   "C:/Users/pcmet/Documents/license_plater_recog/logs/pm2-exit-combined.log",
      time: true,
      env: { NODE_ENV: "production" }
    }
  ]
}


