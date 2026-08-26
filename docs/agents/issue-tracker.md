# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments with `jq` and fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with suitable `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` or `gh issue edit <number> --remove-label "..."`
- **Close an issue**: `gh issue close <number> --comment "..."`

Infer the repository from `git remote -v`. The `gh` CLI does this automatically when run inside the clone.

## Pull requests as a triage request source

**PRs as a request source: no.** Set this to `yes` if the repo later treats external pull requests as feature requests.

When set to `yes`, pull requests use the same labels and states as issues:

- **Read a pull request**: `gh pr view <number> --comments` and `gh pr diff <number>`
- **List external pull requests for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, then keep only `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` author associations.
- **Comment, label, or close**: use `gh pr comment`, `gh pr edit --add-label`, `gh pr edit --remove-label`, or `gh pr close`.

GitHub shares one number sequence across issues and pull requests. For a reference such as `#42`, try `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

The `/wayfinder` skill uses one issue as a map and linked issues as tickets.

- **Map**: Create one issue labeled `wayfinder:map`. Its body holds Notes, Decisions-so-far, and Fog.
- **Child ticket**: Link the ticket to the map as a GitHub sub-issue. If sub-issues are unavailable, add the child to a task list in the map and put `Part of #<map>` at the top of the child body. Apply one `wayfinder:<type>` label: `research`, `prototype`, `grilling`, or `task`.
- **Blocking**: Use GitHub's native issue dependencies. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`. Get the numeric database ID with `gh api repos/<owner>/<repo>/issues/<number> --jq .id`. If dependencies are unavailable, put `Blocked by: #<number>` at the top of the child body.
- **Frontier query**: List the map's open children, remove tickets with open blockers or an assignee, and take the first remaining ticket in map order.
- **Claim**: Run `gh issue edit <number> --add-assignee @me`. This is the session's first write.
- **Resolve**: Comment with the answer, close the ticket, then add a context link to the map's Decisions-so-far section.
