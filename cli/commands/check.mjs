import { checkReport, inspectSetup } from "../lib/setup.mjs";
import {
  listPackageRuleFiles,
  loadBranchFlow,
  readRepositoryFiles,
  requireRepositoryRoot,
} from "./repository-files.mjs";

/** @returns {number} 0 when the setup is what `init` leaves behind with no manual step, 1 otherwise */
export function runCheck() {
  const directory = process.cwd();
  requireRepositoryRoot(directory, "check");
  // Read for its validation only: a configuration the hooks cannot use fails this check too.
  loadBranchFlow(directory);
  const report = checkReport(
    inspectSetup(readRepositoryFiles(directory), listPackageRuleFiles()),
  );
  const print = report.exitCode === 0 ? console.log : console.error;
  for (const line of report.lines) print(line);
  return report.exitCode;
}
