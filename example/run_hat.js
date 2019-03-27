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
    }

    var tracker_config = {
        ...config,

        // Provide more succinct relationship names
        getArrayRelationshipName: function (config, relationship) {
            if (relationship.key1 === relationship.key2)
                return relationship.table1;
            else
                return relationship.key1.replace(config.primaryKeySuffix, "") + "_" + relationship.table1;
        },

        // Provide more succinct relationship names
        getObjectRelationshipName: function (config, relationship) {
            if (relationship.key1 === relationship.key2)
                return relationship.key1.replace(config.primaryKeySuffix, "");
            else
                return relationship.table1 + "_" + relationship.key1.replace(config.primaryKeySuffix, "");
        }
    };

    const hat = new HasuraAutoTracker();

    // Execute the tracker configuration
    hat.ExecuteHasuraAutoTracker(tracker_config);
});

