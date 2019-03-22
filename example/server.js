    //
    // Example method of loading hasura-auto-tracker configuration and executing the configuration process
    //
    
    import ExecuteHasuraTracker from "..";

    var fs = require('fs');
    var tracker_config;
    var tracker_log = true; // If true, writes status messages to console

    fs.readFile("./hasura-auto-tracker.json", (err, data) => {
        tracker_config = JSON.parse(data.toString());

        // Execute the tracker configuration
        ExecuteHasuraTracker(tracker_config, tracker_log);
    });

