const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const scriptFiles = [
  path.join(projectRoot, "public", "runtime-config.js"),
  ...fs.readdirSync(path.join(projectRoot, "public", "js"))
    .filter((fileName) => fileName.endsWith(".js"))
    .sort()
    .map((fileName) => path.join(projectRoot, "public", "js", fileName)),
  path.join(projectRoot, "public", "sw.js")
];

for (const scriptFile of scriptFiles) {
  const result = spawnSync(process.execPath, ["--check", scriptFile], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Checked ${scriptFiles.length} public JavaScript files.`);
