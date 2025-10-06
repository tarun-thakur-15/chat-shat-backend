import cron from "node-cron";
import fs from "fs";
import path from "path";
import os from "os";

export function scheduleCompressedFileCleanup() {
  cron.schedule("0 0 * * *", () => {
    console.log("🕛 Running midnight cleanup of compressed files...");

    const tmpDir = os.tmpdir();

    fs.readdir(tmpDir, (err, files) => {
      if (err) {
        console.error("❌ Failed to read temp dir:", err);
        return;
      }

      files.forEach((file) => {
        if (file.startsWith("compressed-") && file.endsWith(".jpg")) {
          const filePath = path.join(tmpDir, file);
          fs.unlink(filePath, (err) => {
            if (err) console.error(`❌ Failed to delete ${file}:`, err);
            else console.log(`🗑 Deleted ${file}`);
          });
        }
      });
    });
  });
}
