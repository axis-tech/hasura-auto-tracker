#!/usr/bin/env node

const HasuraAutoTracker = require('./index.js')
const fs = require('fs')
const path = require('path')

const HELP = `
hasura-auto-tracker
  --config          use a config file if present
                    defaults to hasura-auto-track.json

  --hasuraEndpoint  the hasura endpoint to connect to
                    only used when the config file isn't present
                    eg: http://localhost:8080/v1/query

  --targetSchema    the postgres db target schema to connect to
                    only used when the config file isn't present
                    defaults to public

  --silent          don't print logs as the tool runs
                    defaults to false

  --version         print the version
`

const {
  config,
  hasuraEndpoint,
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
if (fs.existsSync(config)) {
  hatConfig = require(path.join(__dirname, config))
} else if (hasuraEndpoint) {
  hatConfig = {
    hasuraEndpoint,
    targetSchema,
    views: [],
    relationships: [],
  }
} else {
  console.log(HELP)
  process.exit()
}

console.log(`hasura-auto-tracker will run with the following configuration:
${JSON.stringify(hatConfig, null, '  ')}`)

new HasuraAutoTracker().ExecuteHasuraAutoTracker(hatConfig, !silent)
