/**
 * Prevents `npm run build` from corrupting an active dev server's .next folder.
 */
import { execSync } from "node:child_process";

const ports = [3000, 3001];

function portInUse(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return out.includes("LISTENING");
  } catch {
    return false;
  }
}

const busy = ports.filter(portInUse);
if (busy.length > 0) {
  console.error(
    "\n❌ Build blocked: dev server is running on port(s) " +
      busy.join(", ") +
      ".\n\n" +
      "   `npm run build` and `npm run dev` both use the same .next folder.\n" +
      "   Building while dev is running corrupts CSS and causes 404 on layout.css.\n\n" +
      "   Stop dev first (Ctrl+C), or run:  npm run dev:reset\n" +
      "   Then build in a separate step when dev is stopped.\n"
  );
  process.exit(1);
}
