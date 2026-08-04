import { defineDatabaseConfig } from '@holo-js/db'

export default defineDatabaseConfig(
{
  "defaultConnection": "default",
  "connections": {
    "default": {
      "driver": "sqlite",
      "url": "./data/database.sqlite",
      "schema": "public",
      "logging": false
    }
  }
}
)
