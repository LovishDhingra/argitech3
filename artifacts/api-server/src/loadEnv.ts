import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// 1. Try standard process.cwd()
dotenv.config();

// 2. Walk up process.cwd() to locate .env
let currentDir = process.cwd();
for (let i = 0; i < 5; i++) {
  const envPath = path.join(currentDir, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
  const parent = path.dirname(currentDir);
  if (parent === currentDir) break;
  currentDir = parent;
}

// 3. Walk up relative to current module to locate .env
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    const envPath = path.join(dir, ".env");
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
} catch (e) {
  // Ignore
}
