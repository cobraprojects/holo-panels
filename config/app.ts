import { defineAppConfig } from '@holo-js/config'

export default defineAppConfig(
{
  "name": "Holo",
  "key": "",
  "url": "http://localhost:3000",
  "debug": true,
  "env": "development",
  "plugins": [],
  "paths": {
    "models": "server/models",
    "migrations": "server/db/migrations",
    "generatedSchema": ".holo-js/generated/schema.generated.ts",
    "seeders": "server/db/seeders",
    "observers": "server/db/observers",
    "factories": "server/db/factories",
    "commands": "server/commands",
    "jobs": "server/jobs",
    "events": "server/events",
    "listeners": "server/listeners",
    "authorizationPolicies": "server/policies",
    "authorizationAbilities": "server/abilities"
  }
}
)
