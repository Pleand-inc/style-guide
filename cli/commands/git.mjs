import { execFileSync } from "node:child_process";

/** @returns {string} the checked-out branch; empty on a detached HEAD */
export function currentBranch() {
  return execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  }).trim();
}

/** @returns {string | null} the URL of the `origin` remote, or null when the checkout has none */
export function originUrl() {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return url.trim();
  } catch {
    return null;
  }
}
