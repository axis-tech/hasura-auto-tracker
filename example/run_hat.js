//
// Example method of loading hasura-auto-tracker configuration and executing the configuration process
//

const HasuraAutoTracker = require("../index.js");
const tracker_log = true; // If true, writes status messages to console
const fs = require('fs');
const configFile = "./example/hasura-auto-tracker.json";

fs.readFile(configFile, (err, data) => {
    if (!data) {
        throw "Failed to read " + configFile;
    }

    var tracker_config = JSON.parse(data.toString());
    const hat = new HasuraAutoTracker();

    // Execute the tracker configuration
    hat.ExecuteHasuraAutoTracker(tracker_config, tracker_log);
});

