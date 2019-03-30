//
// Example method of loading hasura-auto-tracker configuration and executing the configuration process
//

const HasuraAutoTracker = require("../index.js");
const fs = require('fs');
const configFile = "./example/hasura-auto-tracker.json";

fs.readFile(configFile, (err, data) => {
    if (!data) {
        throw "Failed to read " + configFile;
    }

    var config = JSON.parse(data.toString());

    // Support execution of individual commands from CLI
    if (!config.operations) {
        config.operations = {};
        config.operations.untrack = true;
        config.operations.trackTables = true;
        config.operations.trackRelationships = true;
        config.operations.trackFunctions = true;
    }

    const hat = new HasuraAutoTracker();

    // Calling this method sets the relationship naming functions in the config
    // The relationships will have compact names using just a table name when possible
    // The relationship functions call camelCaseSingularName in order to get a singular form from a plural, e.g. customer from customers
    // Refer to the hasura-auto-tracker source code for more details on how to build naming functions
    hat.UseCompactRelationshipNaming(config);

    // Execute the tracker configuration
    hat.ExecuteHasuraAutoTracker(config);
});

