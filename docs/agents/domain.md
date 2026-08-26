# Domain docs

Holo Panels uses a single-context domain-documentation layout.

## Read before exploring

- Read `CONTEXT.md` at the repository root.
- Read ADRs under `docs/adr/` that concern the area being changed.

If either location is absent, proceed without requesting that it be created. The domain-modeling skill creates domain documents when the project resolves a term or architectural decision.

## File structure

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── packages/
```

## Use the glossary's vocabulary

Use terms as defined in `CONTEXT.md` in issue titles, specifications, proposals, hypotheses, and test names. Do not substitute terms that the glossary explicitly marks under `Avoid`.

If a needed concept is missing, first check whether existing project language already covers it. Record a genuine terminology gap for the domain-modeling skill.

## Flag ADR conflicts

Call out any proposal that contradicts an existing ADR. Name the ADR and explain why the decision may need reconsideration instead of silently overriding it.
