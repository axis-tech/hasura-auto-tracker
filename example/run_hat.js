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
    
    var tracker_config = {
        ...config,
        getArrayRelationshipName: null,  // Add your own function(relationship_spec) - return a string
        getObjectRelationshipName: null // Add your own function(relationship_spec) - return a string
    };


    const hat = new HasuraAutoTracker();

    // Execute the tracker configuration
    hat.ExecuteHasuraAutoTracker(tracker_config);
});

