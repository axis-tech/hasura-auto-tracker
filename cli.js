#!/usr/bin/env node

const HasuraAutoTracker = require('./index.js')
const fs = require('fs')
const path = require('path')

const HELP = `
hasura-auto-tracker
  --config              use a config file if present
                        defaults to hasura-auto-track.json

  --hasuraEndpoint      the hasura endpoint to connect to
                        only used when the config file isn't present
                        eg: http://localhost:8080/v1/query

  --hasuraAdminSecret   the hasura admin secret
                        to access hasura endpoint
                        eg: myadminsecretkey

  --targetSchema        the postgres db target schema to connect to
                        only used when the config file isn't present
                        defaults to public

  --silent              don't print logs as the tool runs
                        defaults to false

  --version             print the version
`

const {
  config,
  hasuraEndpoint,
  hasuraAdminSecret,
  help,
  targetSchema,
  silent,
  version,
} = require('minimist')(process.argv.slice(2), {
  alias: {
    help: 'h',
  },

  booleans: ['help', 'silent', 'version'],

  default: {
    config: 'hasura-auto-tracker.json',
    hasuraEndpoint: null,
    hasuraAdminSecret: null,
    help: false,
    targetSchema: 'public',
    silent: false,
    version: false,
  },
})

if (help) {
  console.log(HELP)
  process.exit()
}

if (version) {
  console.log(require('./package.json').version)

  process.exit()
}

let hatConfig = null
const configFile = path.join(process.cwd(), config);
if (fs.existsSync(configFile)) {
  hatConfig = require(configFile)
} else if (hasuraEndpoint) {
  hatConfig = {
    hasuraEndpoint,
    hasuraAdminSecret,
    targetSchema,
    views: [],
    relationships: [],
  }
} else {
  console.log(HELP)
  process.exit()
}

// Copy from example/run_hat.js
if (!hatConfig.operations) {
    hatConfig.operations = {};
    hatConfig.operations.untrack = true;
    hatConfig.operations.trackTables = true;
    hatConfig.operations.trackRelationships = true;
}

console.log(`hasura-auto-tracker will run with the following configuration:
${JSON.stringify(hatConfig, null, '  ')}`)

new HasuraAutoTracker().ExecuteHasuraAutoTracker(hatConfig, !silent)
