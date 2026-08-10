import { execFileSync } from "node:child_process";

import type { MetadataRoute } from "next";

import { absoluteUrl, DEMO_PATH, ROUTES } from "@/lib/routes";

const REPO = "mblode/react-vello";

/**
 * Committer date of HEAD from a local checkout, ISO 8601.
 *
 * Undefined on Vercel: the build runs against exported source with no `.git`,
 * which is exactly how the first attempt at this shipped four URLs with no
 * `lastmod` at all. `remoteCommitDate` is the path that covers that build.
 */
const localCommitDate = (): string | undefined => {
  try {
    return execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};

/**
 * The same date from the GitHub API, for a build that knows its commit SHA but
 * does not carry the repository. Unauthenticated and once per build, so the
 * 60-per-hour limit is not a concern.
 */
const remoteCommitDate = async (): Promise<string | undefined> => {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (!sha) {
    return undefined;
  }
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/commits/${sha}`,
      { headers: { accept: "application/vnd.github+json" } }
    );
    if (!res.ok) {
      return undefined;
    }
    const body = (await res.json()) as {
      commit?: { committer?: { date?: string } };
    };
    return body.commit?.committer?.date;
  } catch {
    return undefined;
  }
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The commit the build came from, not the clock. A build timestamp moves on
  // every redeploy and would claim all four pages changed when none did, which
  // is the kind of lastmod Google learns to ignore. When neither source
  // answers, none is emitted rather than a guess.
  const lastModified = localCommitDate() ?? (await remoteCommitDate());

  return ROUTES.map((path) => ({
    url: absoluteUrl(path),
    ...(lastModified ? { lastModified } : {}),
    priority: path === DEMO_PATH ? 1 : 0.8,
  }));
}
