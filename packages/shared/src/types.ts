/** Site blueprint types available for new site creation */
export type BlueprintType =
  | "solo-artist"
  | "band"
  | "composer-educator"
  | "epk-focused"
  | "tour-focused";

/** Job types for the platform's async task system */
export type JobType =
  | "create_site"
  | "edit_site"
  | "migrate_site"
  | "repair_site"
  | "deploy_config";

/** Job status lifecycle */
export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_review"
  | "canceled";

/** Classification modes for edit requests */
export type EditMode =
  | "content_edit"
  | "asset_update"
  | "page_add"
  | "page_remove"
  | "nav_change"
  | "style_update"
  | "widget_update"
  | "repair";

/** Change request status */
export type ChangeRequestStatus =
  | "pending"
  | "in_progress"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "discarded";

/** Integration provider identifiers */
export type IntegrationProvider = "github" | "netlify";

/** Site status lifecycle */
export type SiteStatus =
  | "creating"
  | "active"
  | "error"
  | "archived";

/** Asset upload status */
export type AssetUploadStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "committed"
  | "failed";

/** Deploy preview status */
export type PreviewStatus =
  | "queued"
  | "building"
  | "ready"
  | "failed";
