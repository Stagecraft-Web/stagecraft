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
  // Use first 8 chars of CR id for a short, unique branch name
  const branchName = `edit/${changeRequestId.slice(0, 8)}`;

  try {
    // Mark in_progress and record the branch name
    await prisma.changeRequest.update({
      where: { id: changeRequestId },
      data: { status: "in_progress", branchName },
    });

    // 1. Create branch from default branch
    await createBranch(userId, owner, repo, baseBranch, branchName);

    // 2. Fetch the primary content file for this edit mode
    const targetFile = MODE_PRIMARY_FILE[classifiedMode] ?? "src/content/pages/home.md";

    let fileContent = "";
    try {
      fileContent = await getFileContent(userId, owner, repo, targetFile, baseBranch);
    } catch {
      // File may not exist in this site's template variant — start from empty
    }

    // 3. Apply edit
    // TODO: Replace this stub with a real Claude API call that applies the
    // requested change to the file content using the edit mode as a scope hint.
    const editedContent = applyStubEdit(fileContent, requestText, classifiedMode, targetFile);

    // 4. Commit the change to the branch
    const commitMessage = `[stagecraft] ${requestText.slice(0, 72)}`;
    await pushFiles(
      userId,
      owner,
      repo,
      branchName,
      [{ path: targetFile, content: editedContent }],
      commitMessage
    );

    // 5. Open a PR
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
        `**File:** \`${targetFile}\``,
        ``,
        `---`,
        ``,
        `_This PR was opened automatically by Stagecraft. Review the diff before merging._`,
      ].join("\n"),
      head: branchName,
      base: baseBranch,
    });

    // 6. Persist PR metadata and mark ready for review
    const summary = `Changed \`${targetFile}\` (${classifiedMode.replace(/_/g, " ")})`;
    await prisma.changeRequest.update({
      where: { id: changeRequestId },
      data: {
        prNumber: pr.number,
        summary,
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
      // Malformed JSON — return unchanged so the PR at least opens
      return content;
    }
  }

  // Markdown and other text files
  return (
    content +
    `\n\n<!-- [Stagecraft pending edit]\n` +
    `     Mode: ${mode}\n` +
    `     Request: ${truncated}\n` +
    `     Queued: ${timestamp}\n` +
    `     TODO: Replace with real AI-applied change -->\n`
  );
}
