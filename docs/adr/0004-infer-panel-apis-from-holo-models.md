# Infer panel APIs from Holo model declarations

Holo Panels derives Resource and Relation manager field paths, record types, form values, and action contexts from Holo's migration-generated declarations. A Resource declares its model once, while a Relation manager declares only its relationship and receives its owner and related types through the parent Resource. Generated bindings preserve this inference through normal imports and direct arrays, avoiding duplicated schemas, user-written generics, casts, and callback annotations.
