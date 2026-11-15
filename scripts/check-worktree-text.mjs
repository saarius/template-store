import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { textFailures } from "./worktree-text-audit.mjs";

const paths = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);

const failures = [];

for (const path of paths) {
  if (!existsSync(path)) continue;
  failures.push(...textFailures(path, readFileSync(path)));
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`worktree text audit: ${failure}`);
  process.exit(1);
}

console.log("worktree text audit: ok");
