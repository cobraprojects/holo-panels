# Use shadcn Table without TanStack Table

Resource and relation-manager tables use the normal shadcn Table components with Holo table behavior layered on top. Holo owns selection, sorting, filtering, pagination, column visibility, bulk actions, loading, and empty-state coordination through its existing table package and server protocol. The project deliberately does not add TanStack Table because the required behavior already belongs to Holo and the extra dependency would duplicate that responsibility.
