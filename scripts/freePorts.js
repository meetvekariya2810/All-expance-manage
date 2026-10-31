const { execSync } = require('child_process');

const ports = [5000, 5173];

console.log('🔍 Checking and freeing ports 5000 and 5173...');

ports.forEach(port => {
  try {
    if (process.platform === 'win32') {
      let output = '';
      try {
        output = execSync(`netstat -ano -p tcp | findstr :${port}`).toString();
      } catch (e) {
        // findstr returns exit code 1 if no matches found
        return;
      }

      const lines = output.trim().split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid) && parseInt(pid) > 0 && parseInt(pid) !== process.pid) {
          pids.add(pid);
        }
      });

      pids.forEach(pid => {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`✅ Freed port ${port} (terminated process ${pid})`);
        } catch (e) {
          // Process might have already exited
        }
      });
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
    }
  } catch (err) {
    // Port already free
  }
});

console.log('🚀 Ready to start server and client.\n');

