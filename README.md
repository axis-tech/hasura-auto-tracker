# hasura-auto-tracker

`hasura-auto-tracker` is a tool to automatically configure Hasura tracking features, and additionally generates SQL views to expose JSON values as SQL columns. 

In the absence of `hasura-auto-tracker` developers are required to create custom code and SQL scripts, and also manually configure Hasura through its user interface.

`hasura-auto-tracker` provides the following benefits:

- Driven by a JSON configuration which can cater for a wide range of applications

- Automatically configure Hasura tracking across tables, views and foreign key relationships in any schema

- Generate SQL views to unpack JSON values into SQL columns and support custom relationships back to source data tables

- Provide an extensible means of specifying custom relationship names

- Integrate Hasura configuration into a continuous integration / delivery process

# Proud Hasura Supporters

[Hasura](https://hasura.io) provides instant realtime GraphQL on Postgres. With a highly active international community, Hasura is a trusted platform
to provide secure and high-performance GrapQL in a wide variety of use-cases.

[Visit the Hasura website](https://hasura.io)


## AxisTech 
AxisTech proudly supports the Hasura community, and has granted permission for `hasura-auto-tracker` to be open sourced, having originally developed this
module to support its continuous integration process.

AxisTech is an Australian IoT device and solution developer working in Smart Agriculture, Smart Cities and Smart Industry. 

[Visit the AxisTech website](https://www.axistech.co)

## NamSource 
NamSource is a technology partner of AxisTech.

We enable startups and innovators to thrive and lead a global, socially conscious economy, driven by affordable technology solutions.

[Visit the NamSource website](https://www.namsource.com)


# Overview of hasura-auto-tracker
## Problem Statement
Hasura can not query the values of JSON objects stored in SQL table columns. One workaround is to create a view to expose required JSON values
as SQL columns. The JSON values can then be used in SQL statements  like any other SQL data.

Creating such a SQL view leads to a potential need to maintain a relationship between the view and the original data table from whence the table sourced data.

Tools to solve these problems are common and well understood, being regular SQL scripts which can create views, and the Hasura user interface, which enables the user to track tables and views (exposing them in GraphQL form). The Hasura user interface also provides the ability to manually add relationships.

This leads to two further problems: 

1. The views must be consistently and automatically created when the solution is built and deployed in development, test and production environments.

2. Manual effort (interacting with a user interface) is required to configure Hasura with the new relationships details.

So we have the following issues to solve:

1. How might we create views that expose a required set of JSON values

2. How might we create a relationship between such views and the tables from which they source data

3. How might we integrate the creation of such views and relationships into a continuous delivery process

## Solution Outline
In order to address the above problems we require the following:

1. A configuration format which specifies how to configure Hasura with additional views and relationships.

2. A tool which creates views and relationships in accordance with the specified configuration.

3. There will be complex use cases, so the configuration must be flexible in respect of the types of queries that the views could use, and the fact that configuration may involve tables and views in multiple schema.

The following sections will assume that a table called `messages` exists in the `public` schema having the following columns:

- `message_id`     an integer value used as the primary key
- `createdAt`      a timestamp value maintained by the database 
- `payload`        a JSON data type
- `source_device`  an integer foreign key to the devices table, relating the message to its source device


A JSON payload would exist in the messages table, as a column with a value formatted thus:

    {
        timestamp: 1234567890
        stationd_id: 1, 
        temperature: 24.7
    }

## Solution Objectives
The first objective is to create SQL views, the following being an example statement which would need to be automatically generated and executed in
order to actually place the view in the SQL database:
    
    DROP VIEW public.device_readings;
    CREATE VIEW public.device_readings AS
    SELECT 
        messages.message_id, 
        messages.createdAt,
        (messages.payload ->> 'timestamp'::text)::timestamp without time zone AS "timestamp",
        (messages.payload ->> 'stationd_id'::text)::integer AS station_id,
        (messages.payload ->> 'temperature'::text)::double precision AS temperature
    
    FROM public.messages AS messages
    ORDER BY messages.createdAt;

    COMMENT ON VIEW public.device_readings IS 'Convert JSON values into SQL columns';

The second objective having created the view is to create a relationship between the view and the source data table, in this case `messages`

In order to achieve this object a call to the [Hasura API](https://docs.hasura.io/1.0/graphql/manual/api-reference/index.html) is required to execute a query:

    {
        "type": "create_object_relationship",
        "args": {
            "table": {
                "name": "device_readings",
                "schema": "public"
            },
            "name": "readings_source_message",
            "using": {
                "manual_configuration": {
                    "remote_table": {
                        "name": "messages",
                        "schema": "public"
                    },
                    "column_mapping": {
                        "message_id": "message_id"
                    }
                }
            }
        }
    }

By achieving this the device_readings view will expose JSON values together with SQL data all sourced from the messages table:

    SELECT timestamp, station_id, temperature, message_id, createdAt
    FROM device_readings

In Hasura GraphQL, the ability will exist to query the device_readings view:

    {
        device_readings
        { 
            station_id 
            temperature
        }
    }

In Hasura GraphQL, the ability will exist to query the device_readings view:

    {
        device_readings
        { 
            station_id 
            temperature
        }
    }

Additionally, because the new relationship is in place between the view and the source message table, from where the view gathers data:

    {
        device_readings
        { 
            station_id 
            temperature
            {
                message_devices
                {
                    device
                    {
                        name
                    }
                }
            }
        }
    }


# Configuration of hasura-auto-tracker
`hasura-auto-tracker` uses a JSON configuration file to capture the specification of views and relationships.

The configuration below specifies an endpoint for Hasura, a target database schema which is the context for the configuration process, i.e. views will be created here
and table, view and foreign key metadata will be sourced in relation to this schema. All views, tables and foreign key relationships within the target schema will be tracked. 

A list of views is then specified, each having a `jsonColumn` which is where the JSON data is sourced from, followed by a list of JSON values with their name, each 
accompanied by a name used for the resulting SQL column, and data type for that column.

In case there are yet further relationships required for database views that exist in the schema, but are not created by this process, the `relationships` key provides an array of relationship details.

## Specification of Relationship Details
The following describes how to form a relationship specification. There is a very subtle difference between the relationship specification here, and that used within the `view` specification. In the `view` context there is no need to specificy a `srcTable` as this is inferred as the view itself.

In the `relationships` section at the foot of the JSON, the `srcTable` must be specified, as this can not be inferred from any where else.

    [
        {
            "type": "create_object_relationship (for 1:1) or create_array_relationship (for 1:*)",
            "name": "name_of_this_tiew",
            "srcTable": "name_of_source_where_json_payload_column_is_located",
            "srcKey": "column_name_related_to_source_table",
            "destTable": "source_table_name",
            "destKey": "source_table_primary_key_name"
        }
    ]

## Example `hasura-auto-tracker` Configuration

Refer to [hasura-auto-tracker.json](https://github.com/axis-tech/hasura-auto-tracker/blob/master/example/hasura-auto-tracker.json)

    {
        "hasuraEndpoint": "http://localhost:4010/v1/query",
        "targetSchema": "public",
        "views": [
            {
                "name": "payload",
                "description": "Convert JSON fields into SQL columns",
                "query": {
                    "select": "SELECT messages.\"messageId\"",
                    "from": "FROM public.messages AS messages",
                    "join": "",
                    "where": "",
                    "orderBy": "ORDER BY \"timestamp\""
                },
                "columns": {
                    "jsonColumn": "messages.payload",
                    "jsonValues": [
                        {
                            "jsonName": "timestamp",
                            "sqlName": "timestamp",
                            "sqlType": "TIMESTAMP"
                        },
                        {
                            "jsonName": "temperature",
                            "sqlName": "temperature",
                            "sqlType": "FLOAT"
                        },
                        {
                            "jsonName": "station_id",
                            "sqlName": "station_id",
                            "sqlType": "INTEGER"
                        }
                    ]
                },
                "relationships": [
                    {
                        "type": "create_object_relationship",
                        "name": "sourceMessage",
                        "srcKey": "messageId",
                        "destTable": "messages",
                        "destKey": "messageId"
                    }
                ]
            }
        ],
        "relationships": [
        ]
    }


# Executing the Configuration Process

Refer to [main.js](https://github.com/axis-tech/hasura-auto-tracker/blob/master/example/server.js)

    import ExecuteHasuraTracker from "./src/hasura/hasura-auto-tracker";

    var fs = require('fs');
    var tracker_config;
    var tracker_log = true; // If true, writes status messages to console

    fs.readFile("./src/hasura/tracker-config.json", (err, data) => {
        tracker_config = JSON.parse(data.toString());
    });

    // Execute the tracker configuration
    ExecuteHasuraTracker(tracker_config, tracker_log);

# Dependencies 

- An Hasura endpoint must exist and be accessible

- [Axios](https://github.com/axios) used  to execute Hasura API calls

# Advanced Use Cases

## Relationship naming
`hasura-auto-tracker` is somewhat oppinionated in terms of SQL column names. The preferred style is `tableId`, e.g. `messagesId`, however, this is a very personal preference.

The column names and table names are used as a basis to form the names of Hasura relationships and poor naming in this sense makes writing queries somewhat less intuitive.

To support a wider range of naming styles, a relationship can include a `name` key, e.g. `{... name: "relationship_name", ... }`.

Additionally, two functions can be inserted into the configuration option built within the `ExecuteHasuraTracker` method, [refer hasura-auto-tracker.js](https://github.com/axis-tech/hasura-auto-tracker/blob/master/index.js).

`getArrayRelationshipName` and `getObjectRelationshipName` will both receive the relationship specification and are expected to return a string that would be a 
unique name for the relationship. If these functions are not specified `hasura-auto-tracker` will create relationship names but these may either be unsuitable, or may \
prove to be non-unique due to the existence of other database entities / relationships.

If the config contains null values for `getArrayRelationshipName` and `getObjectRelationshipName`, then `hasura-auto-tracker` will take full responsibility for naming relationships.

In simple use cases, with the assumed naming convention of `keyId`, `hasura-auto-tracker` should be successful in providing intuitively named relationships.

    var config = {
        ...inputConfig,
        getArrayRelationshipName: null,
        getObjectRelationshipName: null,
        logOutput: logOutput
    };

# Disclaimer

hasura-auto-tracker is provided without any form of support, guarantee or warranty.
