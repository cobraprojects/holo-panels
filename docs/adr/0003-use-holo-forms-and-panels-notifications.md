# Use Holo forms and Panels notifications

Dashboard forms use `@holo-js/forms` for client form state and submission handling, with `@holo-js/validation` as the server-authoritative validation engine. Action success and failure feedback uses `@holo-js/panels-notifications`, modeled after Filament Notifications, and ephemeral panel notifications render through Sonner. Renderers do not implement separate form, validation, or direct-toast systems.
