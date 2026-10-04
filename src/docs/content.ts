import { runtimeObservabilityDoc } from "./runtime-observability";
import { guidePages } from "./guides";
import { emailHref, emails } from "../ui/contact";

export type DocGroup = "Get started" | "Connect & index" | "Review changes" | "Reference" | "Guides";

export type DocBlock =
  | { type: "paragraph"; text: string }
  | { type: "callout"; tone: "note" | "warning" | "tip"; title: string; text: string }
  | { type: "steps"; items: Array<{ title: string; text: string }> }
  | { type: "bullets"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; language: string; filename?: string; value: string }
  | { type: "image"; src: string; alt: string; caption: string }
  | { type: "links"; items: Array<{ label: string; href: string; description?: string }> };

export interface DocSection {
  id: string;
  title: string;
  blocks: DocBlock[];
}

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  group: DocGroup;
  readingTime: number;
  sections: DocSection[];
}

/** Customer documentation grounded in the connected application's current capabilities. */
export const docPages: DocPage[] = [
  {
    slug: "overview",
    title: "Welcome to Impact Gate",
    description: "Understand your API dependencies and review the impact of a contract change before merging.",
    group: "Get started",
    readingTime: 3,
    sections: [
      {
        id: "what-impact-gate-does",
        title: "What Impact Gate does",
        blocks: [
          { type: "paragraph", text: "Impact Gate connects selected GitHub repositories into an engineering workspace. It discovers API endpoints from OpenAPI documents, finds supported HTTP client references in consumer code, and publishes an advisory report when a pull request changes a contract." },
          { type: "bullets", items: ["See discovered services, endpoints, and static callers in one place.", "Review contract changes alongside consumer code and commit-specific evidence.", "Follow analysis progress in GitHub and the connected dashboard.", "Record deprecation evidence reviews against a particular workspace snapshot."] },
          { type: "callout", tone: "note", title: "Current release", text: "The connected application uses deterministic static analysis. Google and passwordless email sign-in are enabled. Connect existing Prometheus or Datadog accounts to import runtime evidence. External model availability is shown in Settings." },
        ],
      },
      {
        id: "how-it-works",
        title: "The workflow",
        blocks: [
          { type: "steps", items: [
            { title: "Connect an organization", text: "Sign in, authorize your GitHub identity, and connect an installation you administer." },
            { title: "Choose providers and consumers", text: "Select repositories containing API contracts and the applications that call those APIs. Indexing reads their default branches." },
            { title: "Open a pull request", text: "Impact Gate compares supported contracts at the PR's base and head commits, then inspects selected, indexed consumers." },
            { title: "Review the evidence", text: "Read the GitHub check and report, follow the source references, and use dashboard findings to plan changes with the affected owners." },
          ] },
          { type: "callout", tone: "warning", title: "Reports are advisory", text: "A completed check records the result of analysis. Missing findings, a low tier, or a successful check do not establish that a change is compatible with every consumer. Review the report's coverage notes before making a merge decision." },
        ],
      },
      {
        id: "choose-a-guide",
        title: "Choose your next step",
        blocks: [
          { type: "links", items: [
            { label: "Set up your first workspace", href: "/docs/quickstart", description: "Follow the complete path from sign-in to your first PR report." },
            { label: "Read a pull request report", href: "/docs/pull-request-reports", description: "Understand tiers, evidence, coverage gaps, and updated reports." },
            { label: "Explore APIs and callers", href: "/docs/api-usage", description: "Inspect discovered endpoints and their source references." },
            { label: "Resolve a problem", href: "/docs/troubleshooting", description: "Find the next action for sign-in, indexing, and missing reports." },
          ] },
        ],
      },
    ],
  },
  {
    slug: "quickstart",
    title: "Set up your first workspace",
    description: "Connect GitHub, index your repositories, and review your first automatic report.",
    group: "Get started",
    readingTime: 6,
    sections: [
      {
        id: "before-you-begin",
        title: "Before you begin",
        blocks: [
          { type: "bullets", items: ["Use a Google account or an email address you can access.", "Use a GitHub account that owns or administers the organization installation.", "Identify a provider repository with a committed OpenAPI 3 document and at least one supported consumer repository.", "Confirm that the Impact Gate GitHub App can access those repositories."] },
          { type: "callout", tone: "note", title: "Pilot access", text: `Your organization must be enabled for the pilot. Email [${emails.pilot}](${emailHref("pilot")}) if your organization is unavailable during connection. Installing the App alone does not enable a workspace for an unapproved organization.` },
        ],
      },
      {
        id: "connect-and-index",
        title: "Connect and index",
        blocks: [
          { type: "steps", items: [
            { title: "Sign in", text: "Open [Sign in](/sign-in). Choose **Continue with Google**, or enter your email and choose **Send sign-in link**. New users are sent to workspace setup." },
            { title: "Authorize GitHub", text: "On [Connect your workspace](/onboarding), choose **Connect GitHub**. Complete authorization using the GitHub account that administers the intended organization." },
            { title: "Install or select the App", text: "If no installation is available, choose **Install GitHub App** and grant access to the intended repositories. Return to setup, refresh installations, and choose **Connect** beside the correct organization." },
            { title: "Select both sides of the dependency", text: "Under **Choose repositories**, select the API provider and the consumers you want included. Choose **Save selection and start indexing**." },
            { title: "Check indexing results", text: "Open [Repositories](/dashboard/repositories). Wait for queued or indexing jobs to finish, then open **Coverage** for each repository. Resolve missing contracts or other relevant coverage gaps before relying on a report." },
          ] },
          { type: "paragraph", text: "The expected result is a connected workspace with selected repositories, detected services, and any supported OpenAPI endpoints in [API usage](/dashboard/api-usage). A consumer-only repository can provide caller evidence even when it has no provider contract of its own." },
        ],
      },
      {
        id: "first-report",
        title: "Review your first report",
        blocks: [
          { type: "steps", items: [
            { title: "Make a contract change on a branch", text: "In the selected provider repository, make a deliberate change to its committed OpenAPI document. Keep the implementation and published contract consistent. For a reversible walkthrough, use a draft PR on a dedicated branch." },
            { title: "Open the pull request", text: "Create the PR against the appropriate base branch. Draft PRs are analyzed too. Impact Gate receives the event and queues analysis for the PR's exact head and base commits." },
            { title: "Find the check and comment", text: "In GitHub, look for the **Impact Gate** check. If **Publish findings as pull request comments** is enabled, the PR also receives a report comment. Analysis continues in the background." },
            { title: "Inspect dashboard findings", text: "Open [Engineering overview](/dashboard), find the PR under **Open findings**, and select an endpoint to read the explanation and source evidence. Coverage findings can appear even when no affected consumer was confirmed." },
            { title: "Complete the walkthrough", text: "Read the coverage notes, confirm the analyzed head matches your latest commit, and close an example draft PR when finished. Keep normal review and compatibility checks in your delivery process." },
          ] },
          { type: "callout", tone: "tip", title: "Nothing appeared?", text: "Start with [Missing PR reports](/docs/troubleshooting#missing-pr-report). Confirm installation access, saved repository selection, completed indexing, and the current PR head before opening another PR." },
        ],
      },
      {
        id: "next-steps",
        title: "Next steps",
        blocks: [
          { type: "links", items: [
            { label: "Understand your PR report", href: "/docs/pull-request-reports" },
            { label: "Explore the engineering overview", href: "/docs/dashboard" },
            { label: "Review supported contracts and coverage", href: "/docs/coverage-and-limitations" },
          ] },
        ],
      },
    ],
  },
  {
    slug: "sign-in",
    title: "Sign in and manage your account",
    description: "Use Google or a passwordless email link, return to your workspace, and manage connected sign-in methods.",
    group: "Get started",
    readingTime: 4,
    sections: [
      {
        id: "choose-a-method",
        title: "Choose a sign-in method",
        blocks: [
          { type: "paragraph", text: "Open [impactgate.in/sign-in](/sign-in). Signing in creates an account if you are new. Repository authorization is completed separately when you connect GitHub." },
          { type: "image", src: "/docs/images/sign-in.webp", alt: "Impact Gate sign-in page with Continue with Google and a work email field for passwordless sign-in.", caption: "Use Google or request a passwordless email link. GitHub repository access is connected during workspace setup." },
          { type: "table", headers: ["Method", "What you need", "What happens"], rows: [
            ["Google", "Access to your Google account", "Choose Continue with Google and complete the sign-in window."],
            ["Passwordless email", "Access to the email inbox you enter", "Receive a one-time sign-in link; no password is required."],
          ] },
          { type: "callout", tone: "note", title: "GitHub and account sign-in", text: "GitHub sign-in is not enabled on this deployment. You can still authorize the GitHub App after signing in with Google or email. A GitHub connection does not change your website sign-in method." },
        ],
      },
      {
        id: "google-sign-in",
        title: "Sign in with Google",
        blocks: [
          { type: "steps", items: [
            { title: "Choose Continue with Google", text: "Allow the sign-in popup for impactgate.in if your browser blocks it." },
            { title: "Choose your account", text: "Complete Google's sign-in flow. Use the account you intend to associate with your engineering workspace." },
            { title: "Open your workspace", text: "You are returned to the requested page when you already have a workspace. New users continue to [workspace setup](/onboarding)." },
          ] },
        ],
      },
      {
        id: "email-sign-in",
        title: "Sign in with an email link",
        blocks: [
          { type: "steps", items: [
            { title: "Enter your email", text: "Enter the address in **Work email**, then choose **Send sign-in link**." },
            { title: "Open the message", text: "Check your inbox and spam folder. Open the latest Impact Gate sign-in link, preferably in the browser where you requested it." },
            { title: "Confirm the address if requested", text: "When opening the link on another browser or device, enter the same address under **Confirm your email** and choose **Complete sign-in**." },
            { title: "Continue", text: "After verification, your existing account opens or a new account is created. Request a new link if the previous link expired or was already consumed." },
          ] },
          { type: "callout", tone: "tip", title: "Use the latest link", text: "A sign-in link grants access to your account. Keep it private and request a fresh link when you cannot complete the current one. You do not need to send a link to your workspace owner." },
        ],
      },
      {
        id: "account-settings",
        title: "Manage your account",
        blocks: [
          { type: "paragraph", text: "In [Settings](/dashboard/settings), **Sign-in methods** shows the providers connected to your current account. **Connect Google** links an enabled provider to that account. Passwordless email sign-in remains available from the sign-in page." },
          { type: "paragraph", text: "If a provider reports that an account already uses your email, sign in with your existing method first, then link the provider from the signed-in account. This keeps your workspace attached to the same identity." },
          { type: "paragraph", text: "Use **Sign out** in the workspace navigation to end the browser session. An expired or revoked session sends you back to sign-in. A verified email is required to connect GitHub or change workspace data." },
          { type: "links", items: [{ label: "Resolve sign-in errors", href: "/docs/troubleshooting#sign-in-errors" }, { label: "Connect GitHub", href: "/docs/connect-github" }] },
        ],
      },
    ],
  },
  {
    slug: "connect-github",
    title: "Connect the GitHub App",
    description: "Install Impact Gate, verify organization access, and connect the intended installation to your workspace.",
    group: "Connect & index",
    readingTime: 5,
    sections: [
      {
        id: "requirements",
        title: "Requirements",
        blocks: [
          { type: "bullets", items: ["A signed-in Impact Gate account with a verified email.", "A GitHub account that owns or administers the intended organization installation.", "Approval to install the App and grant access to the intended repositories.", "An organization enabled for this pilot deployment."] },
          { type: "callout", tone: "note", title: "Two access decisions", text: "Installing the App grants repository permissions in GitHub. Connecting the installation verifies your GitHub identity and creates or links a workspace membership. The server checks both before exposing workspace data." },
        ],
      },
      {
        id: "install-and-connect",
        title: "Install and connect",
        blocks: [
          { type: "steps", items: [
            { title: "Open workspace setup", text: "Go to [Connect your workspace](/onboarding) and choose **Connect GitHub**. If you already have a workspace, use **Manage GitHub connection** in Repositories or **Manage connection** in Settings." },
            { title: "Authorize the intended GitHub account", text: "Complete the GitHub authorization screen using the account that administers your organization. Stay in the same browser while completing this flow." },
            { title: "Install Impact Gate if needed", text: "On **Choose a GitHub installation**, choose **Install GitHub App** if the intended organization is missing. In GitHub, select the organization, review the permissions, and grant access to the repositories you plan to analyze." },
            { title: "Refresh available installations", text: "Return to Impact Gate and use **Refresh installations** after installing or updating access. Only installations verified for your GitHub account and enabled deployment appear." },
            { title: "Confirm the organization", text: "Choose **Connect** beside the intended organization. Setup should show its account name and an **active** installation status." },
            { title: "Choose repositories", text: "Continue with [Select and index repositories](/docs/repositories). App installation access defines what can be selected; your workspace selection defines what is analyzed." },
          ] },
        ],
      },
      {
        id: "requested-permissions",
        title: "Requested permissions",
        blocks: [
          { type: "table", headers: ["Scope", "Permission", "Purpose"], rows: [
            ["Repository contents", "Read", "Read supported contracts and consumer source at immutable commits."],
            ["Pull requests", "Read and write", "Read PR state and update an advisory report comment."],
            ["Checks", "Read and write", "Publish and update the Impact Gate check for a PR head."],
            ["Repository metadata", "Read", "Identify repositories, owners, and installation access."],
            ["Organization members", "Read", "Verify that the connecting GitHub user administers the organization."],
            ["Account email addresses", "Read", "Included in the App's GitHub user authorization; website sign-in still uses its own verified identity."],
          ] },
          { type: "paragraph", text: "The application reads repository source without executing it. It does not request repository contents write access. PR comments and checks are the publication actions performed by the App." },
        ],
      },
      {
        id: "change-or-remove-access",
        title: "Change or remove access",
        blocks: [
          { type: "paragraph", text: "Manage repository permissions from your organization's GitHub App installation settings. After granting additional repositories, return to **Manage GitHub connection**, reconnect if needed, and refresh the repository choices." },
          { type: "paragraph", text: "Removing repository access, suspending the installation, uninstalling the App, or revoking GitHub authorization can stop eligible analysis. Pending work rechecks selection and authorization before publishing. GitHub App access and website sign-out are separate controls." },
          { type: "callout", tone: "tip", title: "Reconnect after restoring access", text: "After an installation has been unsuspended or authorization has changed, reconnect it in Impact Gate. The open-PR recovery process does not reactivate a suspended workspace installation." },
          { type: "links", items: [{ label: "Troubleshoot an unavailable installation", href: "/docs/troubleshooting#github-installation" }, { label: "Permissions and data handling", href: "/docs/permissions-and-data" }] },
        ],
      },
    ],
  },
  {
    slug: "repositories",
    title: "Select and index repositories",
    description: "Build a useful workspace by indexing API providers and the applications that consume them.",
    group: "Connect & index",
    readingTime: 6,
    sections: [
      {
        id: "choose-the-right-repositories",
        title: "Choose providers and consumers",
        blocks: [
          { type: "paragraph", text: "Select the repositories that define your API contracts and the repositories that call those APIs. Findings can only use consumer code available within the selected, indexed workspace. Repositories outside that scope remain unobserved." },
          { type: "table", headers: ["Repository role", "What to include", "What it contributes"], rows: [
            ["Provider", "Committed OpenAPI 3 documents and service manifests", "Endpoints, schemas, and PR contract comparisons."],
            ["Consumer", "Supported JavaScript, TypeScript, or Java HTTP client code", "Static caller references and consumer evidence."],
            ["Combined service or monorepo", "Contracts, consumers, and manifests under service roots", "Detected services associated with their repository paths."],
          ] },
          { type: "callout", tone: "tip", title: "Start with a small connected set", text: "Begin with one provider and its known consumers. Check names, endpoints, and coverage before expanding the selection. Selecting only the provider can leave consumer impact unknown." },
        ],
      },
      {
        id: "save-selection",
        title: "Save your selection",
        blocks: [
          { type: "steps", items: [
            { title: "Open repository selection", text: "During onboarding, use **Choose repositories**. Later, open [Repositories](/dashboard/repositories) and choose **Select repositories**." },
            { title: "Review installation access", text: "The list contains available, non-archived repositories granted to the connected App installation. Each row shows the repository, public or private visibility, detected language, and default branch." },
            { title: "Select the intended set", text: "Check the provider and consumers. You can select up to 100 repositories. Ask an owner or admin to save the selection if you have view access." },
            { title: "Save and start indexing", text: "Choose **Save selection and start indexing**. Wait for the server confirmation; indexing is then queued for newly selected repositories." },
            { title: "Review each result", text: "Watch **Analysis jobs** and the repository status. Use **Coverage** to inspect supported files, skipped files, OpenAPI documents, notes, and the indexed commit." },
          ] },
          { type: "callout", tone: "warning", title: "Deselecting a repository changes scope", text: "Deselecting a repository removes its indexed data from this workspace and cancels its pending analysis. Existing GitHub comments remain in GitHub. Encrypted backups follow their separate retention schedule." },
        ],
      },
      {
        id: "indexing-status",
        title: "Understand indexing status",
        blocks: [
          { type: "table", headers: ["Status", "Meaning", "Next action"], rows: [
            ["Queued", "Indexing work has been accepted and is waiting for a worker.", "Watch Analysis jobs; avoid repeatedly submitting the same request."],
            ["Discovering / indexing", "The worker is reading a commit and building services, endpoints, and references.", "Wait for completion; progress is shown with the current phase."],
            ["Indexed", "The supported index completed without a recorded partial-coverage condition.", "Inspect endpoints and callers; the status does not guarantee full application coverage."],
            ["Partial", "A usable snapshot was saved with coverage limitations.", "Open Coverage and assess missing contracts, unsupported code, or file limits."],
            ["Failed", "Indexing could not finish.", "Read the error, restore access or resolve the cause, then choose Re-index."],
          ] },
          { type: "paragraph", text: "A consumer repository with no OpenAPI document can be marked partial while still contributing static caller references. A completed background job means the attempt finished; the repository's **Coverage** explains whether its resulting snapshot is partial." },
        ],
      },
      {
        id: "keep-index-current",
        title: "Keep the index current",
        blocks: [
          { type: "paragraph", text: "Indexing reads an immutable commit from the repository's default branch. **Last index** and the commit shown in **Coverage** identify the saved snapshot. After restoring access or updating a missing contract, choose **Re-index** and wait for a new snapshot." },
          { type: "paragraph", text: "When **Sync default branch when code changes** is enabled in [Settings](/dashboard/settings), default-branch push events queue a refresh. Pull request reports use the PR's own base and head contracts together with the current indexed consumer snapshots." },
          { type: "paragraph", text: "If a consumer is changing on an unmerged branch, its workspace index still represents its indexed default-branch commit. Read the source SHA in a finding before using it to coordinate a cross-repository change." },
          { type: "links", items: [{ label: "Prepare a supported contract", href: "/docs/coverage-and-limitations#prepare-a-contract" }, { label: "Indexing troubleshooting", href: "/docs/troubleshooting#indexing" }] },
        ],
      },
    ],
  },
  runtimeObservabilityDoc,
  {
    slug: "pull-request-reports",
    title: "Read pull request reports",
    description: "Interpret the Impact Gate check, contract changes, consumer evidence, and coverage notes.",
    group: "Review changes",
    readingTime: 7,
    sections: [
      {
        id: "when-analysis-runs",
        title: "When analysis runs",
        blocks: [
          { type: "paragraph", text: "Impact Gate analyzes open pull requests in selected repositories with an active installation and usable repository index. Opening, reopening, updating the head, or marking a PR ready for review can queue analysis. Draft pull requests are included." },
          { type: "paragraph", text: "The App also checks eligible repositories for missed open-PR events. This recovery runs periodically and can recover a PR opened before delivery was active. Several selected repositories may be scanned over multiple batches; it is not an instant delivery guarantee." },
          { type: "paragraph", text: "The report is tied to the PR's exact base and head commits. A later commit supersedes old work. If comments are enabled, the App updates its existing report for the PR instead of adding a new comment for every commit." },
        ],
      },
      {
        id: "find-the-report",
        title: "Find the check and report",
        blocks: [
          { type: "steps", items: [
            { title: "Open the PR in GitHub", text: "Find the **Impact Gate** check in the PR's checks. It starts in progress while analysis is running." },
            { title: "Read the report comment", text: "In the PR conversation, find the App's Impact Gate comment. Comments are controlled by **Publish findings as pull request comments** in Settings." },
            { title: "Confirm the analyzed head", text: "Compare **Analyzed PR head** at the end of the report with the latest PR commit. Open the updated report after pushing additional changes." },
            { title: "Follow the dashboard link", text: "Open the check's details to review the connected dashboard. Sign in with an account that has access to this workspace." },
          ] },
          { type: "image", src: "/docs/images/pull-request-report.webp", alt: "Example Impact Gate pull request report showing assessment summary, a response field removal, and static consumer evidence.", caption: "An example report from an Impact Gate lab repository. Findings depend on the changed contract and the consumers indexed in your workspace." },
        ],
      },
      {
        id: "report-sections",
        title: "Read the sections in order",
        blocks: [
          { type: "table", headers: ["Section", "What to check"], rows: [
            ["Title and Assessment Summary", "The overall assessment and the reasons behind it. Analysis incomplete means the report has coverage limitations."],
            ["Static evidence", "How many indexed call-site references were loaded for changed endpoints. This is not a count of all production callers."],
            ["Breaking Changes Detected", "The HTTP endpoint, change kind, field or location, and before/after contract values."],
            ["Consumer Impact Analysis", "The consumer, verdict, source location, and explanation. Expand any evidence chain when available."],
            ["Suggested Backward-Compatible Alternatives", "Options for preserving compatibility while planning a migration."],
            ["Analyzed PR head", "The immutable head commit represented by the report."],
          ] },
          { type: "callout", tone: "warning", title: "Implementation and contract drift", text: "Deleting a server route or changing behavior without updating its OpenAPI document can leave the breaking change undetected. The report may record a coverage gap for source changes while the contract is unchanged. Keep contracts consistent with implementation and review relevant code changes." },
        ],
      },
      {
        id: "tiers-and-verdicts",
        title: "Tiers, verdicts, and check conclusions",
        blocks: [
          { type: "table", headers: ["Report tier", "Interpretation"], rows: [
            ["High", "A verified affected consumer has high or critical importance in the assessment."],
            ["Medium", "A consumer is affected, or unresolved consumer impact or coverage requires review."],
            ["Low", "A breaking contract change was found without confirmed affected consumers in the available evidence."],
            ["None", "No breaking change was detected in the analyzed supported contract scope."],
          ] },
          { type: "paragraph", text: "When analysis is incomplete, its title emphasizes that state rather than presenting an overall risk tier. Individual dashboard findings can still carry a risk label so that coverage gaps and potential impacts remain visible." },
          { type: "image", src: "/docs/images/pull-request-evidence.webp", alt: "Expanded three-step evidence chain showing the changed API contract, consumer call site, and field read; the consumer remains possible because the deployment host is unresolved.", caption: "An evidence chain can show a contract, call site, and field read while impact remains possible because the deployment host association is unresolved." },
          { type: "table", headers: ["Consumer result", "Meaning"], rows: [
            ["verified / affected", "The inspected evidence establishes use of the changed interface within the analysis scope."],
            ["possible / cannot_tell", "The relationship or impact is plausible, but the available evidence cannot establish it."],
            ["not_affected", "The inspected consumer handling did not show the specific detected impact; the conclusion is limited to that analysis."],
            ["observed caller, code not analyzed", "A caller reference was available, but its code impact was not analyzed completely."],
          ] },
          { type: "paragraph", text: "A GitHub **success** conclusion means the supported analysis completed. **Neutral** is used when coverage is incomplete, analysis is unavailable, or work was superseded. Reports are advisory; these conclusions are not a compatibility certification. Repository owners remain responsible for branch protection configuration." },
        ],
      },
      {
        id: "act-on-findings",
        title: "Act on a finding",
        blocks: [
          { type: "steps", items: [
            { title: "Read the contract difference", text: "Check that the reported endpoint and field match the intended change. Follow the provider source reference at the recorded commit." },
            { title: "Inspect the consumer", text: "Open the linked consumer source and verify the call and field handling with that service's owner. Path-based relationships can remain possible when deployment host association is unverified." },
            { title: "Choose a migration approach", text: "Consider retaining a field during migration, adding a versioned endpoint, or coordinating consumer updates. Suggested alternatives are starting points for review." },
            { title: "Push the revision", text: "Update code and contract together. Wait for analysis at the new head, then compare the revised evidence and remaining coverage gaps." },
          ] },
          { type: "links", items: [{ label: "Findings in the dashboard", href: "/docs/dashboard" }, { label: "Coverage and limitations", href: "/docs/coverage-and-limitations" }, { label: "A PR has no report", href: "/docs/troubleshooting#missing-pr-report" }] },
        ],
      },
    ],
  },
  {
    slug: "dashboard",
    title: "Use the engineering overview",
    description: "Monitor repository analysis and investigate the latest open pull request findings.",
    group: "Review changes",
    readingTime: 3,
    sections: [
      {
        id: "workspace-summary",
        title: "Read your workspace summary",
        blocks: [
          { type: "paragraph", text: "Open [Engineering overview](/dashboard). Its totals show repositories, discovered services, API endpoints, and open findings from the current workspace snapshot. **API inventory by service** shows how discovered endpoints are distributed across services." },
          { type: "paragraph", text: "The totals change as repositories are selected, indexed, or removed and as PR analyses are saved. An empty inventory usually means indexing is pending or no supported provider contract has been discovered. Use **Manage repositories** to inspect scope and coverage." },
          { type: "paragraph", text: "If your account has multiple workspaces, use the workspace selector in the navigation. The displayed organization and data update to the selected membership." },
        ],
      },
      {
        id: "monitor-jobs",
        title: "Monitor analysis jobs",
        blocks: [
          { type: "table", headers: ["Job state", "What it means"], rows: [
            ["Queued", "Work is waiting for processing."],
            ["Running", "The current phase and progress describe the active attempt."],
            ["Completed", "The job finished and saved its result; inspect repository or report coverage separately."],
            ["Failed", "The attempt could not finish. Read its error and resolve the underlying cause."],
            ["Superseded", "Newer commits or an access/selection change made this job obsolete."],
          ] },
          { type: "paragraph", text: "Active pages refresh periodically. Updates pause while the page is hidden, settings are being edited, or a dialog is open. Close the dialog or refresh the page to fetch the latest view immediately." },
        ],
      },
      {
        id: "investigate-findings",
        title: "Investigate open findings",
        blocks: [
          { type: "steps", items: [
            { title: "Search the list", text: "Use **Search endpoints and consumers** to match an endpoint, consumer, or explanation." },
            { title: "Read the finding", text: "Select its endpoint to open the risk, verdict, explanation, and recorded source references." },
            { title: "Open the PR", text: "Use the PR link to read the complete report and check the latest head. A coverage_gap finding explains an analysis limitation and can have no specific endpoint or consumer." },
            { title: "Review the evidence in context", text: "Follow commit-specific source links, then coordinate with the relevant service owner. Source access still depends on your GitHub repository permissions." },
          ] },
          { type: "callout", tone: "note", title: "No open findings", text: "This means the current snapshot has no open findings matching the view. It can also reflect missing contracts, unindexed consumers, an unanalyzed PR, or limited coverage. Check Repositories and the GitHub report before drawing a compatibility conclusion." },
          { type: "links", items: [{ label: "Explore individual APIs", href: "/docs/api-usage" }, { label: "Review service dependencies", href: "/docs/dependency-graph" }] },
        ],
      },
    ],
  },
  {
    slug: "api-usage",
    title: "Explore APIs and callers",
    description: "Inspect discovered endpoints, request and response schemas, caller evidence, and contract change history.",
    group: "Review changes",
    readingTime: 4,
    sections: [
      {
        id: "find-an-endpoint",
        title: "Find an endpoint",
        blocks: [
          { type: "steps", items: [
            { title: "Open API usage", text: "Go to [API usage](/dashboard/api-usage). The table lists HTTP method, endpoint path, provider service, static callers, runtime coverage, and criticality." },
            { title: "Search or filter", text: "Use **Search APIs and services** to find a method, path, or service. Select a service in the filter to narrow the table; choose **Clear** to reset it." },
            { title: "Select the endpoint", text: "Choose its path to open the endpoint detail panel below the table." },
          ] },
        ],
      },
      {
        id: "endpoint-details",
        title: "Inspect endpoint details",
        blocks: [
          { type: "table", headers: ["Tab", "What it shows", "How to use it"], rows: [
            ["Overview", "Provider service, static caller count, runtime state, criticality/confidence, source, and available schemas.", "Check the contract source and inspect the request/response shape."],
            ["Callers", "Detected caller services, evidence type, confidence, and source references.", "Follow the caller source to review the relationship and field usage."],
            ["Change history", "Recorded findings associated with this endpoint and links to their pull requests.", "Review previous detected contract changes in the retained history."],
          ] },
          { type: "paragraph", text: "A source reference includes a file, line, and commit SHA. GitHub opens the recorded commit rather than the latest branch, so the evidence remains tied to the snapshot or analysis that produced it." },
          { type: "paragraph", text: "The displayed request and response schemas are extracted from supported documents. Complex or unsupported schema constructs can leave analysis incomplete. Review the repository's Coverage notes when an expected schema or endpoint is missing." },
        ],
      },
      {
        id: "interpret-usage",
        title: "Interpret usage and confidence",
        blocks: [
          { type: "paragraph", text: "**Static callers** counts detected relationships in selected indexed repositories. It does not measure traffic volume or capture every deployed consumer. A relationship inferred from a unique endpoint path still requires verification of the deployment host association." },
          { type: "table", headers: ["Runtime label", "Meaning"], rows: [
            ["Runtime not connected", "No runtime observation source is connected; production usage is unknown."],
            ["No observations in window", "The data model has no observation in its relevant window; this alone cannot establish non-use."],
            ["Estimated requests / indexed spans", "Positive runtime traffic matched the endpoint. The endpoint detail includes source, window, and available caller identity."],
          ] },
          { type: "callout", tone: "note", title: "Current deployment", text: "Runtime starts disconnected. Follow the [Prometheus and Datadog guide](/docs/runtime-observability) to connect an existing source. Its query scope, sampling, and service mapping determine coverage." },
          { type: "links", items: [{ label: "Understand coverage", href: "/docs/coverage-and-limitations" }, { label: "Review deprecation candidates", href: "/docs/deprecation-review" }] },
        ],
      },
    ],
  },
  {
    slug: "dependency-graph",
    title: "Explore the dependency graph",
    description: "Follow service relationships, inspect endpoint references, and export a workspace snapshot.",
    group: "Review changes",
    readingTime: 3,
    sections: [
      {
        id: "read-the-graph",
        title: "Read the graph",
        blocks: [
          { type: "paragraph", text: "Open [Dependency graph](/dashboard/dependency-graph). Each node represents a discovered service. A directed arrow goes from a caller service toward the provider service for a detected endpoint relationship." },
          { type: "paragraph", text: "The graph reflects the current workspace snapshot. Multiple endpoint relationships can connect the same pair of services. The service and relationship totals describe recorded evidence, not the complete deployed topology." },
          { type: "callout", tone: "note", title: "Static relationships need context", text: "The current deployment derives relationships from supported code references and unique endpoint paths. Host association is unverified, so inspect the reference before treating a graph edge as an established production dependency." },
        ],
      },
      {
        id: "inspect-relationships",
        title: "Inspect relationships",
        blocks: [
          { type: "steps", items: [
            { title: "Find a service", text: "Use **Search services** to narrow the graph. The evidence filter offers static, runtime, or combined evidence; runtime filters can be empty on this deployment." },
            { title: "Select a node", text: "Select a service to inspect its root path, criticality, endpoints, and static caller counts. Select an endpoint in the inspector to open its source evidence." },
            { title: "Read the relationships table", text: "Use the table below the graph for caller, target service, endpoint, evidence type, and confidence. It also provides keyboard-accessible relationship details." },
            { title: "Reset the view", text: "Choose **Fit view** to bring graph nodes into view. Use **Clear** to reset search and evidence filters." },
          ] },
        ],
      },
      {
        id: "export-snapshot",
        title: "Export a snapshot",
        blocks: [
          { type: "paragraph", text: "Choose **Export snapshot** to download `impact-gate-dependencies.json`. The export includes `snapshotId`, services, endpoints, and edges from the current workspace. It exports the full snapshot even when the graph view is filtered." },
          { type: "paragraph", text: "Use the snapshot ID and source commit references when sharing a dependency review. The export can contain private repository paths and source links; share it according to your organization's access rules." },
          { type: "links", items: [{ label: "Inspect API callers", href: "/docs/api-usage" }, { label: "Repository scope and indexing", href: "/docs/repositories" }] },
        ],
      },
    ],
  },
  {
    slug: "deprecation-review",
    title: "Review deprecation candidates",
    description: "Assess evidence, record a review for the current snapshot, and plan removals with service owners.",
    group: "Review changes",
    readingTime: 4,
    sections: [
      {
        id: "review-boundary",
        title: "What a candidate means",
        blocks: [
          { type: "paragraph", text: "[Deprecation candidates](/dashboard/deprecation-candidates) collects endpoints for evidence review. The status and reason summarize what is known about static callers and runtime coverage. A candidate is a starting point for investigation." },
          { type: "callout", tone: "warning", title: "Unknown usage is not zero usage", text: "Missing, stale, sampled, or unmapped runtime observations leave usage unknown. No static caller located means none was found in the selected repositories; it does not prove that an endpoint is unused. A review acknowledgment does not approve a production removal." },
          { type: "paragraph", text: "With runtime usage unknown, candidates remain in states such as **flagged** or **building confidence**. The page also has filters for **rare caller** and **strong candidate**, but these can be empty with the available evidence." },
        ],
      },
      {
        id: "record-a-review",
        title: "Record an evidence review",
        blocks: [
          { type: "steps", items: [
            { title: "Find the endpoint", text: "Search candidate paths or reasons, or filter by status. Review its static caller count and runtime label." },
            { title: "Open Review evidence", text: "Read the candidate reason and follow the provider and available caller source references." },
            { title: "Verify outside the index", text: "Check relevant traffic, consumers outside the selected repositories, externally maintained clients, and team migration obligations before planning a removal." },
            { title: "Mark reviewed for this snapshot", text: "An owner or admin with a verified email can record the review using **Mark reviewed for this snapshot**. Wait for server confirmation." },
            { title: "Revisit changed evidence", text: "A later snapshot can show **Previous snapshot — review updated evidence**. Reopen the evidence and record a fresh review when appropriate. Use **Mark needs review** to remove the current acknowledgment." },
          ] },
        ],
      },
      {
        id: "plan-a-removal",
        title: "Plan a removal",
        blocks: [
          { type: "bullets", items: ["Confirm which consumers and deployment environments are outside the indexed scope.", "Agree on a migration window and ownership with affected teams.", "Keep API contracts consistent with the proposed implementation change.", "Review the removal PR's report and all coverage gaps.", "Use your established production observation and rollback procedures."] },
          { type: "links", items: [{ label: "Understand static and runtime evidence", href: "/docs/coverage-and-limitations" }, { label: "Read a removal PR report", href: "/docs/pull-request-reports" }] },
        ],
      },
    ],
  },
  {
    slug: "settings",
    title: "Configure your workspace",
    description: "Control default-branch synchronization, PR comments, and retained analysis history.",
    group: "Reference",
    readingTime: 4,
    sections: [
      {
        id: "save-preferences",
        title: "Save workspace preferences",
        blocks: [
          { type: "steps", items: [
            { title: "Open Settings", text: "Go to [Settings](/dashboard/settings) and confirm the intended workspace in the navigation." },
            { title: "Adjust Workspace preferences", text: "An owner or admin with a verified email can change the editable preferences." },
            { title: "Choose Save preferences", text: "Changes take effect after the server confirms the save. If someone changed the settings while you were editing, refresh and reapply your intended changes." },
          ] },
          { type: "callout", tone: "note", title: "Workspace scope", text: "Preferences apply to the selected workspace. A viewer can inspect settings but cannot change them." },
        ],
      },
      {
        id: "available-settings",
        title: "Available settings",
        blocks: [
          { type: "table", headers: ["Setting", "Default / range", "Effect"], rows: [
            ["Analysis mode", "Deterministic static analysis", "The mode used by this deployment; the selector is read-only."],
            ["Sync default branch when code changes", "Enabled", "Default-branch pushes queue repository index refreshes."],
            ["Publish findings as pull request comments", "Enabled", "The App publishes and updates report comments. Disabling it does not disable analysis or checks."],
            ["Allow external model analysis", "Unavailable", "External model processing cannot be enabled on this deployment."],
            ["History retention in days", "90 by default; 7–365 days", "Controls retained job and PR analysis history and evidence review records."],
          ] },
          { type: "paragraph", text: "Retention cleanup runs periodically. Current repository snapshots remain while their repositories are selected. GitHub comments are hosted in GitHub and are not removed by workspace history cleanup. Encrypted backups have a separate retention schedule." },
        ],
      },
      {
        id: "service-criticality",
        title: "Service names and criticality",
        blocks: [
          { type: "paragraph", text: "Service names are discovered from repository and manifest information, such as `package.json` or `spring.application.name`. You can set a discovered service's default criticality in a committed `impact-gate.yaml` file at its service root, then re-index the repository." },
          { type: "code", language: "yaml", filename: "impact-gate.yaml", value: "# Example: place this at the service root.\ncriticality: high\nspec:\n  path: openapi.yaml" },
          { type: "paragraph", text: "Supported criticality values are `high`, `medium`, and `low`. The default is `medium`; configured workspace criticality rules can take precedence. The current Settings screen does not provide a criticality rule editor. The `spec.path` entry helps identify a missing or invalid configured document; the file must still satisfy supported contract requirements." },
        ],
      },
      {
        id: "connections-and-capabilities",
        title: "Connections and capabilities",
        blocks: [
          { type: "paragraph", text: "**Sign-in methods** shows your account's enabled provider connections. **GitHub App** shows the connected organization and installation state; choose **Manage connection** to reconnect authorization. Repository access is controlled by the App installation in GitHub." },
          { type: "paragraph", text: "**Runtime observability connections** lets owners and admins enter source access, discover service names, review suggested repository matches, and connect existing Prometheus and Datadog sources. Clear matches are preselected, exceptions use dropdowns, and **Use all suggested matches** applies proposed matches together. Query settings and manual aliases are optional advanced controls. Saved connections support edit, sync, and disconnect. Follow the [connection guide](/docs/runtime-observability) for credentials, instrumentation, and coverage limits." },
          { type: "links", items: [{ label: "Manage your account", href: "/docs/sign-in#account-settings" }, { label: "GitHub App access", href: "/docs/connect-github" }, { label: "Permissions and retention", href: "/docs/permissions-and-data" }] },
        ],
      },
    ],
  },
  {
    slug: "coverage-and-limitations",
    title: "Supported contracts and coverage",
    description: "Prepare contracts for analysis and understand which evidence the current release can establish.",
    group: "Reference",
    readingTime: 7,
    sections: [
      {
        id: "supported-inputs",
        title: "Supported inputs",
        blocks: [
          { type: "table", headers: ["Input", "Current connected support", "Important boundary"], rows: [
            ["Provider API contracts", "OpenAPI 3 documents in YAML or JSON", "Documents need valid paths and resolvable local references; unsupported constructs leave gaps."],
            ["JavaScript / TypeScript consumers", "Supported HTTP client patterns such as fetch and axios", "Highly dynamic URLs, indirect runtime configuration, or unresolved wrappers may not be mapped."],
            ["Java consumers", "Supported HTTP client patterns, including supported Spring clients", "Framework support depends on recognizable source patterns; arbitrary reflection is not established."],
            ["Service identity", "Repository roots and supported package / Spring / deployment manifests", "Discovery may need review in monorepos or unusual layouts."],
            ["Runtime observations", "Prometheus request counters and Datadog indexed APM spans", "Requires an existing instrumented source, explicit service mapping, and fresh successful imports; missing data leaves usage unknown."],
            ["External models", "Not enabled", "The connected worker performs deterministic analysis."],
          ] },
          { type: "paragraph", text: "Source-language support describes extraction capabilities, not complete support for every library or code pattern. Check repository Coverage and individual report notes for the actual result in your codebase." },
        ],
      },
      {
        id: "prepare-a-contract",
        title: "Prepare a contract",
        blocks: [
          { type: "steps", items: [
            { title: "Commit the document", text: "Keep the OpenAPI document in the selected provider repository on its default branch. `openapi.yaml`, `openapi.yml`, or a JSON document containing the `openapi` field are recognized examples." },
            { title: "Use OpenAPI 3 and valid paths", text: "Include an OpenAPI 3 version and a valid `paths` object. Swagger 2 documents are not supported by the connected indexer." },
            { title: "Bundle schema references", text: "Use resolvable local references such as `#/components/schemas/Product`. External references and unresolved references prevent a complete contract comparison." },
            { title: "Describe the interface faithfully", text: "Include request parameters, required fields, responses, media types, and relevant security requirements. Update this contract when the implementation changes." },
            { title: "Index and inspect", text: "Save repository selection or choose **Re-index**. Open **Coverage**, then inspect the endpoint and its schemas in **API usage**." },
          ] },
          { type: "code", language: "yaml", filename: "openapi.yaml", value: "# Minimal illustrative provider contract.\nopenapi: 3.0.3\ninfo:\n  title: Product API\n  version: 1.0.0\npaths:\n  /v1/products/{id}:\n    get:\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n      responses:\n        '200':\n          description: Product details\n          content:\n            application/json:\n              schema:\n                type: object\n                required: [id, priceCents]\n                properties:\n                  id:\n                    type: string\n                  priceCents:\n                    type: integer" },
          { type: "paragraph", text: "This example illustrates document shape. Adapt it to your actual interface and normal contract validation process. Renaming the response field would change the contract, while a source-only rename without a matching contract update can leave drift unverified." },
        ],
      },
      {
        id: "contract-changes",
        title: "Examples of contract changes",
        blocks: [
          { type: "table", headers: ["Change", "Why it needs review"], rows: [
            ["Remove an endpoint or response field", "A consumer may still request the endpoint or read the field."],
            ["Add a required request parameter or tighten a constraint", "Previously accepted requests can become invalid."],
            ["Change a response type, media type, or success code", "Parsing and status handling assumptions can change."],
            ["Remove an accepted request enum value", "Existing clients may still send that value."],
            ["Add a response enum value", "Consumers with exhaustive handling may not understand it."],
            ["Change descriptions or operation metadata", "These usually do not alter the HTTP interface; review actual document differences."],
          ] },
          { type: "paragraph", text: "The report describes the detected change kind and its before/after values. The actual impact depends on consumer evidence and coverage; a breaking contract difference can be recorded even when no static caller was located." },
        ],
      },
      {
        id: "partial-coverage",
        title: "Why coverage can be partial",
        blocks: [
          { type: "bullets", items: ["No supported provider document was found, or a document was invalid.", "External or unresolved references prevented a complete contract comparison.", "A repository contains source languages or client patterns outside supported extraction.", "GitHub returned a truncated tree or an expected blob was unavailable.", "A file exceeded the per-file budget, contained binary data, or was a symlink.", "The repository or consumer analysis exceeded a processing budget."] },
          { type: "paragraph", text: "Current repository collection uses a budget of 1,500 candidate files and approximately 24 MiB of declared file data, with a 500 KiB per-file cutoff. Contracts and manifests are prioritized before source when selecting files. Dependencies, build output, test/fixture directories, and lockfiles are excluded. These limits bound collection and do not promise exhaustive parsing of a repository." },
          { type: "paragraph", text: "**Supported files**, **Skipped files**, **OpenAPI documents**, and the notes under **Coverage** describe the saved result. Re-indexing can resolve a missing document or restored access, but it does not add support for an unsupported language." },
        ],
      },
      {
        id: "what-remains-unknown",
        title: "What remains unknown",
        blocks: [
          { type: "bullets", items: ["Implementation behavior or removed routes that are not reflected in the supported contract.", "Consumers outside selected, indexed repositories and clients maintained outside GitHub.", "Production traffic volume and caller inactivity without runtime observations.", "Deployment host associations for relationships inferred from endpoint paths.", "Highly dynamic or reflective calls that static extraction cannot resolve.", "Non-HTTP interfaces such as message queues, gRPC, and application-level WebSocket protocols.", "Downstream effects beyond the code and relationship evidence actually inspected."] },
          { type: "callout", tone: "warning", title: "Read coverage before accepting a result", text: "A report can complete while documenting unknown impact. Use the source evidence, your contract validation, consumer testing, and production observation practices together when planning a change." },
          { type: "links", items: [{ label: "Read coverage in a PR report", href: "/docs/pull-request-reports#report-sections" }, { label: "Review repository coverage", href: "/docs/repositories#indexing-status" }] },
        ],
      },
    ],
  },
  {
    slug: "permissions-and-data",
    title: "Permissions and data handling",
    description: "Understand workspace roles, repository scope, usage analytics, pilot requests, and retention controls.",
    group: "Reference",
    readingTime: 5,
    sections: [
      {
        id: "identity-and-access",
        title: "Identity and access",
        blocks: [
          { type: "paragraph", text: "Website identity is verified through Firebase authentication. GitHub authorization separately verifies access to an enabled App installation. Workspace requests require a valid signed-in identity and an active workspace membership; an installation ID alone does not grant access." },
          { type: "table", headers: ["Role", "Read workspace data", "Change selection, settings, and reviews"], rows: [
            ["Owner", "Yes, within the authorized workspace", "Yes, with a verified email and active access"],
            ["Admin", "Yes, within the authorized workspace", "Yes, with a verified email and active access"],
            ["Viewer", "Yes, within the authorized workspace", "No"],
          ] },
          { type: "paragraph", text: "The current interface does not include self-service member invitations or role management. Ask your deployment owner about workspace membership needs. A website account or ordinary GitHub organization membership alone does not automatically grant a workspace role." },
        ],
      },
      {
        id: "repository-scope",
        title: "Repository scope",
        blocks: [
          { type: "paragraph", text: "GitHub installation permissions limit which repositories the App can access. Saved workspace selection narrows that scope further. The backend rechecks repository availability when changing selection or requesting an index, and analysis checks current authorization before publication." },
          { type: "paragraph", text: "The App uses repository contents read access to fetch supported files at immutable commits. Repository code is not executed. It publishes advisory checks and, when enabled, report comments using their dedicated write permissions." },
          { type: "links", items: [{ label: "See requested App permissions", href: "/docs/connect-github#requested-permissions" }, { label: "Change repository selection", href: "/docs/repositories#save-selection" }] },
        ],
      },
      {
        id: "recorded-data",
        title: "What the workspace records",
        blocks: [
          { type: "bullets", items: ["Your authenticated identity and workspace membership needed for access decisions.", "Connected installation metadata and protected authorization material needed for GitHub access.", "Selected repository metadata, index status, commit SHAs, and parser coverage notes.", "Discovered service and endpoint records, extracted schemas, and source references.", "Analysis jobs, PR findings, explanations, settings, and snapshot-specific evidence reviews.", "Verified webhook delivery records needed for processing and deduplication."] },
          { type: "paragraph", text: "GitHub App keys and authorization tokens are managed on the server. The website receives workspace data for the signed-in membership. Current production analysis is deterministic and does not send consumer slices to an external model provider." },
          { type: "paragraph", text: "Source links open in GitHub under your GitHub permissions. Dashboard exports and screenshots can contain private repository names or paths; share them with the same care as the corresponding engineering documents." },
        ],
      },
      {
        id: "retention-and-removal",
        title: "Retention and removal",
        blocks: [
          { type: "table", headers: ["Data", "Retention behavior"], rows: [
            ["Job and PR analysis history; evidence reviews", "Controlled by History retention in days, from 7 to 365 days; periodic cleanup applies."],
            ["Current repository snapshots", "Remain while the repository is selected; removed from the live workspace when deselected."],
            ["GitHub report comments and checks", "Remain in GitHub under GitHub's controls; workspace cleanup does not remove them."],
            ["Encrypted database backups", "Daily backups use a separate 35-day retention policy, with a further 7-day soft deletion period."],
          ] },
          { type: "paragraph", text: `Removing a repository from a workspace or revoking App access changes live analysis eligibility. It is not a promise of immediate removal from existing backups or from GitHub publications. For privacy, account removal, or retention requests outside the workspace controls, contact [${emails.privacy}](${emailHref("privacy")}).` },
          { type: "links", items: [{ label: "Configure retention", href: "/docs/settings#available-settings" }, { label: "Restore or remove GitHub access", href: "/docs/connect-github#change-or-remove-access" }] },
        ],
      },
      {
        id: "website-analytics",
        title: "Website usage analytics and pilot requests",
        blocks: [
          { type: "paragraph", text: "Impact Gate uses Firebase Analytics, backed by Google Analytics, to understand visits, documentation topics, sign-in, setup, and product actions. Usage events include public page paths, action categories, aggregate counts, and campaign labels. Signed-in journeys use an opaque account identifier. Usage events exclude email addresses, names, repository and service names, source code, typed search text, form contents, authorization URLs, and credentials." },
          { type: "paragraph", text: "Use the Usage analytics button in the website footer or workspace navigation to turn collection off in this browser. Impact Gate also honors Do Not Track and Global Privacy Control. Turning collection off leaves sign-in, the workspace, and the pilot form available; it does not delete events already received by Google." },
          { type: "paragraph", text: "A submitted pilot request contains your work email, organization or repository, and any context you choose to provide. These details are saved separately in a private lead store for 90 days and emailed to the Impact Gate team for follow-up. With usage analytics enabled, the request also includes campaign labels, the public landing page, and the referring hostname. Analytics receives a random lead reference after the server accepts the request, rather than the request's contents. Email copies have separate mailbox retention." },
          { type: "links", items: [{ label: "Request pilot access", href: "/#pilot" }, { label: "Privacy questions or removal requests", href: emailHref("privacy"), description: emails.privacy }] },
        ],
      },
      {
        id: "security-and-privacy-contacts",
        title: "Security and privacy contacts",
        blocks: [
          { type: "paragraph", text: `Send vulnerability reports and security disclosures to [${emails.security}](${emailHref("security")}). For compliance, legal, GDPR, or privacy requests, use [${emails.privacy}](${emailHref("privacy")}).` },
          { type: "links", items: [{ label: "Report a security issue", href: emailHref("security"), description: emails.security }, { label: "Make a privacy or legal request", href: emailHref("privacy"), description: emails.privacy }] },
        ],
      },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshoot common issues",
    description: "Resolve sign-in failures, missing repositories, partial indexing, and missing or outdated PR reports.",
    group: "Reference",
    readingTime: 6,
    sections: [
      {
        id: "start-here",
        title: "Start with the current state",
        blocks: [
          { type: "bullets", items: ["Use the canonical site at impactgate.in and confirm the selected workspace.", "Refresh the affected page and read the visible error or job status.", "Confirm that the installation is active and the intended repository is selected.", "Check Coverage and the indexed SHA before investigating missing findings.", "For a PR, compare the report's analyzed head with the latest commit."] },
        ],
      },
      {
        id: "sign-in-errors",
        title: "Sign-in problems",
        blocks: [
          { type: "table", headers: ["Symptom", "Next action"], rows: [
            ["Google popup blocked or closed", "Allow popups for impactgate.in and try again, or use a passwordless email link."],
            ["Sign-in email has not arrived", "Check the entered address and spam folder, then request a new link if needed."],
            ["Email link invalid, expired, or already used", "Request a fresh link and open the latest message."],
            ["Confirm your email after opening a link", "Enter the same email address that received the link, then Complete sign-in."],
            ["Account exists with another sign-in method", "Sign in using the existing method, then link an enabled provider from Settings."],
            ["Session expired or revoked", "Sign in again using the account that has workspace access."],
            ["Browser could not retain the session", "Allow site storage for impactgate.in, then reload and sign in."],
          ] },
        ],
      },
      {
        id: "github-installation",
        title: "GitHub installation or repository missing",
        blocks: [
          { type: "steps", items: [
            { title: "Check the GitHub account", text: "Authorize the personal GitHub account that owns or administers the organization installation. Verify which account is signed in on github.com." },
            { title: "Check pilot access", text: "Ask your deployment owner whether this organization is enabled. An App installation for an unapproved organization is unavailable to this deployment." },
            { title: "Check installation permissions", text: "In the intended organization's installed GitHub Apps, confirm Impact Gate is installed, active, and granted the relevant repositories. Archived or disabled repositories are not offered for selection." },
            { title: "Reconnect", text: "Use **Manage GitHub connection** or **Manage connection** in Settings and refresh installations. Complete the flow in the same browser before it expires." },
            { title: "Refresh repository selection", text: "Open **Select repositories** again after access changes. Save the intended selection before expecting analysis." },
          ] },
          { type: "paragraph", text: "If connection expired, was canceled, or could not be verified, start a new connection from Impact Gate. Reusing an old callback URL will not complete authorization." },
        ],
      },
      {
        id: "indexing",
        title: "Indexing is partial, failed, or missing APIs",
        blocks: [
          { type: "table", headers: ["Symptom", "Next action"], rows: [
            ["No endpoints discovered", "Confirm a supported OpenAPI 3 document is committed on the indexed default branch. Inspect Coverage."],
            ["Missing or invalid contract", "Correct document syntax, paths, and local references, commit the change, then Re-index."],
            ["Consumer repository marked partial", "Read the notes. A missing provider contract does not by itself prevent supported static caller extraction."],
            ["Unsupported language or file budget", "Treat the recorded snapshot as partial; repeated indexing does not expand supported extraction."],
            ["Failed after GitHub access changed", "Restore repository access, reconnect if needed, then Re-index."],
            ["Queued or running for an unusually long time", "Inspect the latest job phase and error; ask the deployment owner to check worker health if progress remains stalled."],
          ] },
          { type: "links", items: [{ label: "Supported inputs and collection limits", href: "/docs/coverage-and-limitations" }] },
        ],
      },
      {
        id: "missing-pr-report",
        title: "A PR has no report",
        blocks: [
          { type: "steps", items: [
            { title: "Confirm analysis scope", text: "The repository must be selected in the connected workspace, indexed, and accessible to an active App installation. The PR must be open." },
            { title: "Look for the check", text: "Find **Impact Gate** in GitHub's checks. A comment can be absent when **Publish findings as pull request comments** is disabled, even when analysis ran." },
            { title: "Check background jobs", text: "Open Engineering overview or Repositories and inspect **Analysis jobs**. Read a failed job's error before requesting more work." },
            { title: "Allow recovery to scan", text: "Eligible open PRs are checked periodically for missed deliveries, including PRs opened before indexing finished. Larger selections are scanned in batches." },
            { title: "Ask for delivery diagnostics", text: "If no job appears, give the deployment owner the PR URL, repository, current head SHA, and approximate time. An App owner can inspect webhook activation and recent GitHub deliveries." },
          ] },
          { type: "paragraph", text: "You do not need to repeatedly open new PRs to recover a missed delivery. Failed jobs are not retried indefinitely by the open-PR scanner; unresolved worker or authorization failures need attention." },
        ],
      },
      {
        id: "outdated-or-unexpected-results",
        title: "Results are outdated or unexpected",
        blocks: [
          { type: "table", headers: ["Symptom", "Next action"], rows: [
            ["Report shows an older head", "Wait for the new-head job, then refresh GitHub. Superseded work must not replace a newer report."],
            ["No finding for a source-only route or behavior change", "Review whether OpenAPI changed too. Provider implementation drift is unverified."],
            ["No known caller for a used API", "Confirm the consumer is selected, indexed, and written in a supported pattern; verify usage outside static scope."],
            ["Dependency points to an unexpected service", "Inspect the path-based reference and host configuration; deployment host association can be unverified."],
            ["Dashboard has not refreshed", "Close open dialogs and return to the active tab, or reload to fetch the current snapshot."],
            ["Settings changed while editing", "Refresh Settings, review the current values, then reapply and save the intended changes."],
            ["Review belongs to a previous snapshot", "Open the updated evidence and mark reviewed for the current snapshot."],
          ] },
        ],
      },
      {
        id: "share-diagnostics",
        title: "Share useful diagnostics",
        blocks: [
          { type: "bullets", items: ["The affected page URL and intended organization/workspace.", "The repository and PR URL, plus the current head SHA when relevant.", "The visible error, job phase/status, and approximate time with timezone.", "Coverage notes and the indexed commit if an endpoint or caller is missing.", "A cropped screenshot of the affected state when it helps explain the issue."] },
          { type: "paragraph", text: "Keep sign-in links, access tokens, App keys, webhook secrets, and private credentials out of diagnostics. Share private source or repository screenshots only with people who have the corresponding access." },
          { type: "paragraph", text: `Send product and technical questions to [${emails.support}](${emailHref("support")}). Include the affected page, visible error, and approximate time. For pilot access and onboarding, contact [${emails.pilot}](${emailHref("pilot")}).` },
        ],
      },
    ],
  },
  {
    slug: "api-reference",
    title: "Workspace web API reference",
    description: "Understand the versioned endpoints used by the authenticated Impact Gate website.",
    group: "Reference",
    readingTime: 6,
    sections: [
      {
        id: "scope-and-authentication",
        title: "Scope and authentication",
        blocks: [
          { type: "paragraph", text: "The website uses the same-origin `/api/v1` workspace API. This reference describes its current application contract for understanding integrations and diagnostics. The release does not provide public API keys, a machine-account workflow, or a supported automation SDK." },
          { type: "paragraph", text: "Protected routes require a Firebase ID token for the signed-in identity and enforce workspace membership. Write routes also require a verified email and an owner or admin role. The website handles token acquisition and refresh through its authentication client." },
          { type: "callout", tone: "note", title: "Use the website origin", text: "Requests go through impactgate.in. The backend's direct protected API origin rejects requests that bypass the site's configured proxy. The server-side proxy credential is not a customer API key and is never needed in browser code." },
        ],
      },
      {
        id: "configuration-and-session",
        title: "Configuration and session",
        blocks: [
          { type: "table", headers: ["Method", "Path", "Response / purpose"], rows: [
            ["GET", "/api/v1/config", "Public versioned configuration, enabled sign-in methods, and GitHub App installation URL."],
            ["GET", "/api/v1/session", "Authenticated identity, authorized workspace memberships, and deployment capabilities."],
          ] },
          { type: "code", language: "javascript", filename: "Read public sign-in methods", value: "const response = await fetch('/api/v1/config', { cache: 'no-store' });\nif (!response.ok) throw new Error('Configuration unavailable');\nconst config = await response.json();\nconsole.log(config.methods); // ['google', 'email-link'] on this deployment" },
          { type: "paragraph", text: "A session response has `version: 1`, `user`, `workspaces`, and `capabilities`. Each workspace contains an ID, name, role, installation ID, account login, and installation status. `runtimeTelemetry` indicates whether runtime connections are supported. `externalModels` indicates the deployment's external model capability." },
        ],
      },
      {
        id: "workspace-endpoints",
        title: "Workspace endpoints",
        blocks: [
          { type: "paragraph", text: "In the paths below, `{workspaceId}` and `{repositoryId}` are application UUIDs returned by the workspace API. GitHub's numeric repository IDs are used when saving repository selection. These are different identifiers." },
          { type: "table", headers: ["Method", "Path", "Purpose"], rows: [
            ["GET", "/api/v1/workspaces/{workspaceId}/repositories/available", "List available installation repositories and current selection flags."],
            ["PUT", "/api/v1/workspaces/{workspaceId}/repositories", "Replace the selection using unique numeric GitHub repository IDs; at most 100."],
            ["GET", "/api/v1/workspaces/{workspaceId}/snapshot", "Read repositories, services, endpoints, edges, findings, candidates, jobs, and settings."],
            ["POST", "/api/v1/workspaces/{workspaceId}/repositories/{repositoryId}/index", "Queue indexing for a selected, available repository."],
            ["PATCH", "/api/v1/workspaces/{workspaceId}/settings", "Save permitted preferences using the currently displayed settings version."],
            ["POST", "/api/v1/workspaces/{workspaceId}/candidates/{endpointId}/review", "Record or remove an evidence review for the specified snapshot."],
            ["GET", "/api/v1/workspaces/{workspaceId}/runtime", "Read sanitized Prometheus/Datadog connection status and configuration."],
            ["POST", "/api/v1/workspaces/{workspaceId}/runtime/{provider}/test", "Test a source and preview endpoint matches without saving."],
            ["POST", "/api/v1/workspaces/{workspaceId}/runtime/{provider}/discover", "Discover source service names and suggest indexed service matches without saving; mappings may be empty."],
            ["PUT", "/api/v1/workspaces/{workspaceId}/runtime/{provider}", "Test and save source configuration, encrypted credentials and observations."],
            ["POST", "/api/v1/workspaces/{workspaceId}/runtime/{provider}/sync", "Refresh evidence with the saved connection."],
            ["DELETE", "/api/v1/workspaces/{workspaceId}/runtime/{provider}", "Remove a source and its imported evidence."],
          ] },
          { type: "code", language: "json", filename: "Repository selection body — illustrative IDs", value: '{\n  "repositoryIds": [123456789, 987654321]\n}' },
          { type: "paragraph", text: "Saving repository selection returns a workspace snapshot. Queueing an index returns a `job` record. A snapshot includes `version: 1`, its workspace and snapshot identifiers, generation time, and the recorded workspace collections. Consumers must verify the workspace and response version before using it." },
        ],
      },
      {
        id: "versioned-writes",
        title: "Versioned writes",
        blocks: [
          { type: "paragraph", text: "Settings changes include the current settings `version` to prevent overwriting concurrent changes. Read the latest snapshot, send only the intended editable fields, and handle a conflict by refreshing before saving again." },
          { type: "code", language: "json", filename: "Settings patch body — illustrative version", value: '{\n  "version": 3,\n  "syncDefaultBranch": true,\n  "prCommentsEnabled": true,\n  "externalModelsEnabled": false,\n  "retentionDays": 90\n}' },
          { type: "paragraph", text: "Only deterministic analysis is available. Retention must be an integer from 7 to 365. Unsupported fields or attempts to enable an unavailable capability are rejected." },
          { type: "code", language: "json", filename: "Candidate review body — illustrative snapshot", value: '{\n  "snapshotId": "<current-snapshot-id>",\n  "reviewed": true\n}' },
          { type: "paragraph", text: "The review endpoint validates the supplied snapshot against the current evidence. Refresh after a snapshot conflict before recording a new review." },
        ],
      },
      {
        id: "errors",
        title: "Common response statuses",
        blocks: [
          { type: "table", headers: ["Status", "Meaning", "Next action"], rows: [
            ["400", "Invalid input, expired connection flow, or unavailable requested capability.", "Read the application error and correct the request or restart connection."],
            ["401", "Missing, expired, revoked, or otherwise invalid sign-in token.", "Sign in again."],
            ["403", "Insufficient role, unverified identity, inaccessible repository, disallowed account, or missing trusted proxy.", "Restore the required authorization and use the website origin."],
            ["404", "The selected workspace resource is unavailable.", "Refresh the authorized selection and verify application IDs."],
            ["409", "Settings or evidence changed since the request's version/snapshot.", "Refresh current data and review before retrying the change."],
            ["503", "A required application connection or service is unavailable.", "Retry after recovery; involve the deployment owner if it persists."],
          ] },
          { type: "links", items: [{ label: "User-facing troubleshooting", href: "/docs/troubleshooting" }, { label: "Workspace permissions", href: "/docs/permissions-and-data" }] },
        ],
      },
    ],
  },
];

docPages.push(...guidePages);

export const docGroups: DocGroup[] = ["Get started", "Connect & index", "Review changes", "Reference", "Guides"];
