import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isOriginOf,
  parseRepositorySlug,
  resolveRepositorySlug,
} from "../../cli/lib/repository-slug.mjs";

describe("parseRepositorySlug", () => {
  const recognised = [
    "https://github.com/acme/web",
    "https://github.com/acme/web.git",
    "https://github.com/acme/web/",
    "https://github.com/acme/web.git\n",
    "https://user@github.com/acme/web.git",
    "git@github.com:acme/web",
    "git@github.com:acme/web.git",
    "ssh://git@github.com/acme/web.git",
  ];
  for (const url of recognised) {
    it(`reads acme/web from ${JSON.stringify(url)}`, () => {
      assert.equal(parseRepositorySlug(url), "acme/web");
    });
  }

  it("keeps dots, dashes and underscores in the names", () => {
    assert.equal(
      parseRepositorySlug("git@github.com:acme-inc/web_app.js.git"),
      "acme-inc/web_app.js",
    );
    assert.equal(
      parseRepositorySlug("https://github.com/Acme/Web.git"),
      "Acme/Web",
    );
  });

  const unrecognised = [
    "",
    "https://example.com/acme/web.git",
    "git@example.com:acme/web.git",
    "https://github.com/acme",
    "https://github.com/acme/web/tree/master",
    "http://github.com/acme/web.git",
    "/srv/git/web.git",
    "acme/web",
  ];
  for (const url of unrecognised) {
    it(`reads nothing from ${JSON.stringify(url)}`, () => {
      assert.equal(parseRepositorySlug(url), null);
    });
  }
});

describe("resolveRepositorySlug", () => {
  const origin = "git@github.com:acme/web.git";

  it("takes GITHUB_REPOSITORY before the origin remote", () => {
    assert.equal(resolveRepositorySlug("acme/api", origin), "acme/api");
  });

  it("falls back to the origin remote when GITHUB_REPOSITORY is unset or empty", () => {
    assert.equal(resolveRepositorySlug(undefined, origin), "acme/web");
    assert.equal(resolveRepositorySlug("", origin), "acme/web");
  });

  it("is null when neither source names a repository", () => {
    assert.equal(resolveRepositorySlug(undefined, null), null);
    assert.equal(
      resolveRepositorySlug(undefined, "https://example.com/acme/web.git"),
      null,
    );
  });

  it("is null for a GITHUB_REPOSITORY that is not owner/repository, without falling back", () => {
    for (const slug of [
      "acme",
      "acme/web/extra",
      "acme web/x",
      "https://github.com/acme/web",
    ]) {
      assert.equal(resolveRepositorySlug(slug, origin), null, slug);
    }
  });
});

describe("isOriginOf", () => {
  it("compares owner and repository without case", () => {
    assert.equal(isOriginOf("acme/web", "git@github.com:Acme/Web.git"), true);
    assert.equal(isOriginOf("Acme/Web", "https://github.com/acme/web"), true);
  });

  it("is false for another repository, another host, or no origin", () => {
    assert.equal(isOriginOf("acme/web", "git@github.com:acme/api.git"), false);
    assert.equal(
      isOriginOf("acme/web", "https://example.com/acme/web.git"),
      false,
    );
    assert.equal(isOriginOf("acme/web", null), false);
  });
});
