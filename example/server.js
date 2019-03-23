//
// Example method of loading hasura-auto-tracker configuration and executing the configuration process
//

const HasuraAutoTracker = require("./index.js");

var fs = require('fs');
var tracker_config;
var tracker_log = true; // If true, writes status messages to console

fs.readFile("./hasura-auto-tracker.json", (err, data) => {
    tracker_config = JSON.parse(data.toString());

    const hat = new HasuraAutoTracker();

    // Execute the tracker configuration
    hat.ExecuteHasuraAutoTracker(tracker_config, tracker_log);
});

