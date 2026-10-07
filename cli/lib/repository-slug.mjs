// Works out which GitHub repository a command acts on (no I/O).

const SLUG = /^[\w.-]+\/[\w.-]+$/;
const HTTPS_REMOTE =
  /^https:\/\/(?:[^@/]+@)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;
const SSH_REMOTE =
  /^(?:ssh:\/\/)?git@github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

/**
 * @param {string} remoteUrl a git remote URL, `https://github.com/o/r(.git)` or `git@github.com:o/r(.git)`
 * @returns {string | null} `owner/repository`, or null when the URL is not a github.com repository
 */
export function parseRepositorySlug(remoteUrl) {
  const trimmed = remoteUrl.trim();
  const match = HTTPS_REMOTE.exec(trimmed) ?? SSH_REMOTE.exec(trimmed);
  if (match === null) return null;
  return `${match[1]}/${match[2]}`;
}

/**
 * @param {string | undefined} environmentSlug the value of `GITHUB_REPOSITORY`
 * @param {string | null} originUrl the URL of the `origin` remote, or null when the checkout has none
 * @returns {string | null} `owner/repository`, or null when neither source names one
 */
export function resolveRepositorySlug(environmentSlug, originUrl) {
  if (environmentSlug !== undefined && environmentSlug !== "") {
    return SLUG.test(environmentSlug) ? environmentSlug : null;
  }
  if (originUrl === null) return null;
  return parseRepositorySlug(originUrl);
}

/**
 * @param {string} slug
 * @param {string | null} originUrl
 * @returns {boolean} whether `origin` points at `slug`; GitHub compares owner and repository names without case
 */
export function isOriginOf(slug, originUrl) {
  if (originUrl === null) return false;
  return parseRepositorySlug(originUrl)?.toLowerCase() === slug.toLowerCase();
}
