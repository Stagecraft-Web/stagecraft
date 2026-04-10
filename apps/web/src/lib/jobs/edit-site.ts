import { prisma } from "@stagecraft/db";
import type { JobContext, JobResult } from "@stagecraft/queue";
import type { EditMode } from "@stagecraft/shared";
import {
  createBranch,
  getFileContent,
  pushFiles,
  createPullRequest,
} from "@/lib/integrations/github";

interface EditSitePayload {
  changeRequestId: string;
  requestText: string;
  classifiedMode: EditMode;
}

// Primary content file to target for each edit mode
const MODE_PRIMARY_FILE: Record<EditMode, string> = {
  content_edit: "src/content/pages/home.md",
  asset_update: "src/content/config/site.json",
  page_add: "src/content/config/nav.json",
  page_remove: "src/content/config/nav.json",
  nav_change: "src/content/config/nav.json",
  style_update: "src/content/config/theme.json",
  widget_update: "src/content/collections/releases/example.json",
  repair: "src/content/config/site.json",
};

// Content file updated per slot when injecting assets
const SLOT_CONTENT_FILE: Record<string, string> = {
  hero: "src/content/config/site.json",
  gallery: "src/content/collections/photos",
  about: "src/content/pages/about.md",
  press: "src/content/collections/photos",
  logo: "src/content/config/site.json",
};

interface FileToPush {
  path: string;
  content: string;
  encoding?: "utf-8" | "base64";
}

/**
 * Build the set of file changes needed to inject uploaded assets into the site repo.
 * Images are written to src/assets/images/. Content files are updated to reference them.
 */
async function buildAssetFiles(
  siteId: string,
  userId: string,
  owner: string,
  repo: string,
  baseBranch: string
): Promise<{ files: FileToPush[]; assetIds: string[]; summary: string }> {
  const assets = await prisma.assetUpload.findMany({
    where: { siteId, uploadStatus: "ready" },
    orderBy: { createdAt: "asc" },
  });

  if (assets.length === 0) {
    return { files: [], assetIds: [], summary: "" };
  }

  const files: FileToPush[] = [];
  const assetIds: string[] = [];
  const summaryParts: string[] = [];

  // Track JSON content files that need updating (path → parsed object)
  const jsonUpdates: Record<string, Record<string, unknown>> = {};

  for (const asset of assets) {
    if (!asset.temporaryStorageRef) continue;

    // Strip the data URL prefix ("data:<mime>;base64,") to get raw base64
    const commaIdx = asset.temporaryStorageRef.indexOf(",");
    if (commaIdx === -1) continue;
    const base64Content = asset.temporaryStorageRef.slice(commaIdx + 1);

    const repoImagePath = `src/assets/images/${asset.normalizedFilename}`;

    // Add the image binary
    files.push({ path: repoImagePath, content: base64Content, encoding: "base64" });
    assetIds.push(asset.id);

    const publicPath = `/assets/images/${asset.normalizedFilename}`;
    summaryParts.push(`${asset.usageSlot ?? "unassigned"}: ${asset.originalFilename}`);

    if (!asset.usageSlot) continue;

    const slotFile = SLOT_CONTENT_FILE[asset.usageSlot];
    if (!slotFile) continue;

    if (asset.usageSlot === "gallery" || asset.usageSlot === "press") {
      // Create a new photo collection entry
      const photoEntry = {
        src: publicPath,
        alt: asset.alt ?? asset.originalFilename,
        caption: asset.caption ?? null,
        credit: asset.credit ?? null,
      };
      const slug = asset.normalizedFilename.replace(/\.[^.]+$/, "");
      files.push({
        path: `src/content/collections/photos/${slug}.json`,
        content: JSON.stringify(photoEntry, null, 2) + "\n",
      });
    } else if (asset.usageSlot === "hero" || asset.usageSlot === "logo") {
      // Update site.json with the image path
      const siteJsonPath = "src/content/config/site.json";
      if (!jsonUpdates[siteJsonPath]) {
        try {
          const raw = await getFileContent(userId, owner, repo, siteJsonPath, baseBranch);
          jsonUpdates[siteJsonPath] = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          jsonUpdates[siteJsonPath] = {};
        }
      }
      jsonUpdates[siteJsonPath][asset.usageSlot === "hero" ? "heroImage" : "logoImage"] = publicPath;
    } else if (asset.usageSlot === "about") {
      // Prepend a frontmatter image field to about.md
      // We'll handle this via a separate content file update below
      const aboutPath = "src/content/pages/about.md";
      let aboutContent = "";
      try {
        aboutContent = await getFileContent(userId, owner, repo, aboutPath, baseBranch);
      } catch {
        aboutContent = "---\ntitle: About\n---\n";
      }
      aboutContent = injectFrontmatterField(aboutContent, "photo", publicPath);
      files.push({ path: aboutPath, content: aboutContent });
    }
  }

  // Flush JSON updates
  for (const [jsonPath, obj] of Object.entries(jsonUpdates)) {
    files.push({
      path: jsonPath,
      content: JSON.stringify(obj, null, 2) + "\n",
    });
  }

  const summary = summaryParts.length > 0
    ? `Added ${assets.length} image${assets.length === 1 ? "" : "s"}: ${summaryParts.join(", ")}`
    : `Added ${assets.length} image${assets.length === 1 ? "" : "s"}`;

  return { files, assetIds, summary };
}

/** Insert or replace a frontmatter field in a Markdown file. */
export function injectFrontmatterField(content: string, key: string, value: string): string {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    // No frontmatter — prepend it
    return `---\n${key}: ${value}\n---\n\n${content}`;
  }
  const frontmatter = fmMatch[1];
  const keyRegex = new RegExp(`^${key}:.*$`, "m");
  const updatedFm = keyRegex.test(frontmatter)
    ? frontmatter.replace(keyRegex, `${key}: ${value}`)
    : `${frontmatter}\n${key}: ${value}`;
  return content.replace(/^---\n[\s\S]*?\n---/, `---\n${updatedFm}\n---`);
}

export async function handleEditSite(ctx: JobContext): Promise<JobResult> {
  const payload = ctx.job.requestPayload as unknown as EditSitePayload;

  if (!payload?.changeRequestId || !payload?.requestText) {
    return { success: false, message: "Missing required payload fields" };
  }

  const { changeRequestId, requestText, classifiedMode } = payload;
  const userId = ctx.job.userId;
  const siteId = ctx.job.siteId;

  const [changeRequest, site] = await Promise.all([
    prisma.changeRequest.findUnique({ where: { id: changeRequestId } }),
    prisma.site.findUnique({ where: { id: siteId } }),
  ]);

  if (!changeRequest || !site) {
    return { success: false, message: "Change request or site not found" };
  }

  if (!site.githubRepoOwner || !site.githubRepoName) {
    return { success: false, message: "Site has no GitHub repo configured" };
  }

  const { githubRepoOwner: owner, githubRepoName: repo, githubDefaultBranch: baseBranch } = site;
  const branchName = `edit/${changeRequestId.slice(0, 8)}`;

  try {
    await prisma.changeRequest.update({
      where: { id: changeRequestId },
      data: { status: "in_progress", branchName },
    });

    // 1. Create branch from default branch
    await createBranch(userId, owner, repo, baseBranch, branchName);

    const filesToPush: FileToPush[] = [];
    let editSummary = "";
    let assetIdsToCommit: string[] = [];

    if (classifiedMode === "asset_update") {
      // Asset update: inject uploaded images + update content references
      const { files, assetIds, summary } = await buildAssetFiles(
        siteId,
        userId,
        owner,
        repo,
        baseBranch
      );
      filesToPush.push(...files);
      assetIdsToCommit = assetIds;
      editSummary = summary || "No ready assets to commit";

      if (filesToPush.length === 0) {
        // Nothing to commit — mark discarded rather than opening an empty PR
        await prisma.changeRequest.update({
          where: { id: changeRequestId },
          data: { status: "discarded" },
        });
        return { success: false, message: "No ready assets found for this site" };
      }
    } else {
      // Content / other edit: apply stub edit to primary content file
      const targetFile = MODE_PRIMARY_FILE[classifiedMode] ?? "src/content/pages/home.md";
      let fileContent = "";
      try {
        fileContent = await getFileContent(userId, owner, repo, targetFile, baseBranch);
      } catch {
        // File may not exist in this template variant — start from empty
      }

      const editedContent = applyStubEdit(fileContent, requestText, classifiedMode, targetFile);
      filesToPush.push({ path: targetFile, content: editedContent });
      editSummary = `Changed \`${targetFile}\` (${classifiedMode.replace(/_/g, " ")})`;
    }

    // 2. Commit all files to the branch
    const commitMessage = `[stagecraft] ${requestText.slice(0, 72)}`;
    await pushFiles(userId, owner, repo, branchName, filesToPush, commitMessage);

    // 3. Open a PR
    const prTitle = requestText.length > 72
      ? `${requestText.slice(0, 69)}...`
      : requestText;

    const pr = await createPullRequest(userId, owner, repo, {
      title: `[Stagecraft] ${prTitle}`,
      body: [
        `## AI-generated edit`,
        ``,
        `**Request:** ${requestText}`,
        ``,
        `**Mode:** \`${classifiedMode}\``,
        ``,
        editSummary ? `**Changes:** ${editSummary}` : "",
        ``,
        `---`,
        ``,
        `_This PR was opened automatically by Stagecraft. Review the diff before merging._`,
      ].filter((l) => l !== undefined).join("\n"),
      head: branchName,
      base: baseBranch,
    });

    // 4. Mark assets as committed
    if (assetIdsToCommit.length > 0) {
      await prisma.assetUpload.updateMany({
        where: { id: { in: assetIdsToCommit } },
        data: {
          uploadStatus: "committed",
          targetRepoPath: `src/assets/images/`,
        },
      });
    }

    // 5. Persist PR metadata and mark ready for review
    await prisma.changeRequest.update({
      where: { id: changeRequestId },
      data: {
        prNumber: pr.number,
        summary: editSummary,
        status: "ready_for_review",
      },
    });

    return {
      success: true,
      data: {
        changeRequestId,
        branchName,
        prNumber: pr.number,
        prUrl: pr.htmlUrl,
      },
    };
  } catch (error) {
    await prisma.changeRequest.update({
      where: { id: changeRequestId },
      data: { status: "discarded" },
    });

    const message = error instanceof Error ? error.message : "Unknown error during edit";
    return { success: false, message };
  }
}

/**
 * Stub AI edit — annotates the file with the pending request.
 * TODO: Replace with a real LLM call using classifiedMode as a scope constraint.
 */
function applyStubEdit(
  content: string,
  requestText: string,
  mode: EditMode,
  filePath: string
): string {
  const timestamp = new Date().toISOString();
  const truncated = requestText.slice(0, 120);

  if (filePath.endsWith(".json")) {
    try {
      const obj = JSON.parse(content || "{}") as Record<string, unknown>;
      obj._pendingEdit = { mode, request: truncated, queuedAt: timestamp };
      return JSON.stringify(obj, null, 2) + "\n";
    } catch {
      return content;
    }
  }

  return (
    content +
    `\n\n<!-- [Stagecraft pending edit]\n` +
    `     Mode: ${mode}\n` +
    `     Request: ${truncated}\n` +
    `     Queued: ${timestamp}\n` +
    `     TODO: Replace with real AI-applied change -->\n`
  );
}
