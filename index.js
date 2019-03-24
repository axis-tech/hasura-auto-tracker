const axios = require("axios");

//
// The purpose of this code is to allow the caller to track all Postgres tables, views and relationships with a single call
// which goes to support continuous integration as you no longer have to use the Hasura UI to click the buttons to track all tables/relationships.
//
// The code also creates SQL views which can translate JSON values into SQL data columns
//

// hasura-auto-tracker expects primary keys to be named table_id. The '_id' portion is remove to form a compact relationship name. 
// If this is not your naming convention, provide two functions in the config noted below:
// getArrayRelationshipName, a functiontion returning a string, which is used as the relationship name
// getObjectRelationshipName,  a functiontion returning a string, which is used as the relationship name

/*

The functions will receive a parameter of the following specification:

{
    table1: rel.srcTable,       // The table having the foreign key reference e.g. customer
    key1: rel.srcKey,           // The name of the column which is the foreign key reference, e.g. order_id
    table2: rel.destTable,      // The table being referenced, e.g. orders
    key2: rel.destKey,          // The primary key of the referenced table, e.g. order_id
    name: rel.name,             // A unique name to be used for the relationship

    // A single call can create relationships in both directions, ie. customer -> orders (one to many / array relationship)
    // and orders -> customers (one to one / object relationship)

    addArrayRelationship: rel.type == "create_array_relationship",
    addObjectRelationship: rel.type == "create_object_relationship",
}

*/

class HasuraAutoTracker {

    constructor() { }

    async ExecuteHasuraAutoTracker(inputConfig, logOutput) {

        var config = {
            ...inputConfig,
            getArrayRelationshipName: null,  // Add your own function(relationship_spec) - return a string
            getObjectRelationshipName: null, // Add your own function(relationship_spec) - return a string
            logOutput: logOutput
        };

        if (!config.primaryKeySuffix) {
            primaryKeySuffix = "_id";
        }

        this.tracker_log(config, "--------------------------------------------------------------");
        this.tracker_log(config, "");
        this.tracker_log(config, "hasura-auto-tracker  : TRACK TABLES, VIEWS AND RELATIONSHIPS");
        this.tracker_log(config, "                     : GENERATE ADDITIONAL VIEWS FOR JSON DATA");
        this.tracker_log(config, "");
        this.tracker_log(config, "              SCHEMA : '" + config.targetSchema + "'");
        this.tracker_log(config, "     HASURA ENDPOINT : '" + config.hasuraEndpoint + "'");
        this.tracker_log(config, "  PRIMARY KEY SUFFIX : '" + config.primaryKeySuffix + "'");
        this.tracker_log(config, "");
        this.tracker_log(config, "--------------------------------------------------------------");
        this.tracker_log(config, "");

        // --------------------------------------------------------------------------------------------------------------------------
        // Create additional views to flatten JSON to SQL
        if (config.views) {
            this.tracker_log(config, "CREATE SQL VIEWS FOR MESSAGE PAYLOADS");
            this.tracker_log(config, "");
            await this.generateViews(config, config.views);
            this.tracker_log(config, "");
        }

        var table_sql =
            `
        SELECT table_name FROM information_schema.tables WHERE table_schema = '${config.targetSchema}'
        UNION 
        SELECT table_name FROM information_schema.views  WHERE table_schema = '${config.targetSchema}'
        ORDER BY table_name;
        `;

        // Exeute SQL so we get a list of all tables and views in alphabetical order which exist in the specified schema
        return await this.runSQL_Query(config, table_sql)
            .then(async (data) => {

                // Take off the header row which contains the column names, then just get table name (column 0)
                var tables = data.map(t => t[0]).splice(1);

                // --------------------------------------------------------------------------------------------------------------------------
                // Configure HASURA to track all TABLES and VIEWS - tables and views are added to the GraphQL schema automatically
                this.trackTables(config, tables);
                this.tracker_log(config, "");

                const foreignKey_sql =
                    `
                SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
                JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
                WHERE constraint_type = 'FOREIGN KEY' 
                AND tc.constraint_schema = '${config.targetSchema}';
                `;

                // Fetch the list of foreign keys
                return await this.runSQL_Query(config, foreignKey_sql)
                    .then(async (data) => {
                        var fkdata = data.splice(1);
                        var foreignKeys = fkdata.map(fk => {
                            return {
                                table1: fk[0],
                                key1: fk[1],
                                table2: fk[2],
                                key2: fk[3],
                                addArrayRelationship: true,
                                addObjectRelationship: true
                            };
                        });

                        config.relationships.map(rel => foreignKeys.push({
                            table1: rel.srcTable,
                            key1: rel.srcKey,
                            table2: rel.destTable,
                            key2: rel.destKey,
                            name: rel.name,
                            addArrayRelationship: rel.type == "create_array_relationship",
                            addObjectRelationship: rel.type == "create_object_relationship",
                        }));

                        // --------------------------------------------------------------------------------------------------------------------------
                        // Configure HASURA to track all FOREIGN KEY RELATIONSHIPS - enables GraphQL to fetch related (nested) entities
                        return await this.trackRelationships(config, foreignKeys);
                    });
            });
    }


    // --------------------------------------------------------------------------------------------------------------------------
    // Configure HASURA to track all tables and views in the specified schema -> 'HASURA_AUTO_TRACKER'
    async  trackTables(config, tables) {

        tables.map(async (table_name) => {
            this.tracker_log(config, "TRACKING - " + table_name);

            var query = {
                type: "track_table",
                args: {
                    schema: config.targetSchema,
                    name: table_name
                }
            };

            return await this.runGraphQL_Query(config, query).catch(e => {

                if (e.response.data.error.includes("already tracked")) {
                    return;
                }

                this.tracker_log(config, "GRAPHQL QUERY FAILED TO EXECUTE: ");
                this.tracker_log(config, "");
                this.tracker_log(config, arrRel);
                this.tracker_log(config, "");
                this.tracker_log(config, "EXCEPTION DETAILS - creating " + currentRelationshipType + " - " + currentRelationshipName);
                this.tracker_log(config, "");
                this.tracker_log(config, e.response.data);
                this.tracker_log(config, "");
            });;
        });
    }


    // --------------------------------------------------------------------------------------------------------------------------
    // Configure HASURA to track all relationships
    // This requires an array relationship in one direction and an object relationship in the opposite direction
    async  trackRelationships(config, relationships) {

        if ((!config.primaryKeySuffix || config.primaryKeySuffix.trim() == "") &&
            (!config.getArrayRelationshipName || !getObjectRelationshipName)
        ) {
            throw "'config.primaryKeySuffix' is not specified. Both config.getArrayRelationshipName and config.getObjectRelationshipName are required.";
        }

        relationships.map(async (relationship) => {
            await this.createRelationships(config, relationship);
        });
    }

    // --------------------------------------------------------------------------------------------------------------------------
    // It is possible to pass in two functions, which should generate the name of the relationship:
    // getArrayRelationshipName  - Must return a string, used as the name of array relationships
    // getObjectRelationshipName - Must return a string, used as the name of object relationships
    async  createRelationships(config, relationship) {

        if (relationship.addArrayRelationship) {
            const array_rel_spec = {
                type: "create_array_relationship",


                name: relationship.name ? relationship.name :
                    config.getArrayRelationshipName ?
                        config.getArrayRelationshipName(relationship)
                        : relationship.key1.replace(config.primaryKeySuffix, "") + "_" + relationship.table1,


                srcTable: relationship.table2,
                srcKey: relationship.key2,
                destTable: relationship.table1,
                destKey: relationship.key1
            };

            await this.createRelationship(config, array_rel_spec);
        }

        if (relationship.addObjectRelationship) {
            const obj_rel_spec = {
                type: "create_object_relationship",

                name: relationship.name ? relationship.name :
                    config.getObjectRelationshipName ?
                        config.getObjectRelationshipName(relationship)
                        : relationship.table1 + "_" + relationship.key1.replace(config.primaryKeySuffix, ""),

                srcTable: relationship.table1,
                srcKey: relationship.key1,
                destTable: relationship.table2,
                destKey: relationship.key2
            };

            await this.createRelationship(config, obj_rel_spec);
        }
    }

    // --------------------------------------------------------------------------------------------------------------------------
    // Create the specified relationship

    /* Pass an array of array specifications...
    [
        {
            "type": "create_array_relationship" | "create_object_relationship",
            "name": "relationship_name",
            "srcTable": "ParentTable",
            "srcKey": "ForeignKeyName",
            "destTable": "ChildTable",
            "destKey": "PrimaryKeyName"
        }, { }....
    ]
    */

    async  createRelationship(config, relSpec) {
        this.tracker_log(config, "TRACKING RELATIONSHIP - " + relSpec.type + "  name:" + relSpec.name);

        var hasuraApiRelationshipType = {
            type: relSpec.type,
            args: {
                table: {
                    name: relSpec.srcTable, // Parent tables
                    schema: config.targetSchema
                },
                name: relSpec.name, // Relationship name: parent table -> child table
                using: {
                    manual_configuration: {
                        remote_table: {
                            name: relSpec.destTable, // child table
                            schema: config.targetSchema
                        }
                    }
                }
            }
        };

        // I wasn't sure how to add a key where the name is dynamic, which is why I had coded the setup of the foreign_key: primary_key as follows...

        // Initialise with an empty object to specific foreign key -->> primary key
        hasuraApiRelationshipType.args.using.manual_configuration.column_mapping = {};
        // Create a name for the key, and assign a value to the key
        hasuraApiRelationshipType.args.using.manual_configuration.column_mapping[relSpec.srcKey] = relSpec.destKey;

        await this.runGraphQL_Query(config, hasuraApiRelationshipType).catch(e => {

            if (e.response.data.error.includes("already exists")) {
                return;
            }

            this.tracker_log(config, "GRAPHQL QUERY FAILED TO EXECUTE: ");
            this.tracker_log(config, "");
            this.tracker_log(config, hasuraApiRelationshipType);
            this.tracker_log(config, "");
            this.tracker_log(config, "EXCEPTION DETAILS - creating " + relSpec.type + " - " + relSpec.name);
            this.tracker_log(config, "");
            this.tracker_log(config, e.response.data);
            this.tracker_log(config, "");
        });
    }


    //--------------------------------------------------------------------------------------------------------------------------
    // Create Postgres views that flatten JSON payloads into SQL columns
    async  generateViews(config) {
        config.views.map(async (view) => {
            await this.generateView(config, view);
        });
    }


    //--------------------------------------------------------------------------------------------------------------------------
    // Create the view: DROP if exists, create view, add comment to view
    async  generateView(config, view) {
        this.tracker_log(config, "CREATE VIEW - " + view.name);

        view.relationships.map(relationship => {
            config.relationships.push({ ...relationship, srcTable: view.name });
        });

        const view_header =
            `
DROP VIEW IF EXISTS "${config.targetSchema}"."${view.name}";
CREATE VIEW "${config.targetSchema}"."${view.name}" AS
`;

        const view_footer =
            `
COMMENT ON VIEW "${config.targetSchema}"."${view.name}" IS '${view.description}';
`;

        // Build the SQL statement according to the specified JSON columns
        // The columns list is optional
        var view_columns = ""

        if (view.columns) {

            view.columns.jsonValues.map(col => {
                view_columns +=
                    `
CAST(${view.columns.jsonColumn} ->> '${col.jsonName}' AS ${col.sqlType}) AS "${col.sqlName}",`;
            });

        }

        var sql_statement = `
        ${view_header}
        ${view.query.select.trim().replace(/,\s*$/, "")},
        ${view_columns.trim().replace(/,\s*$/, "")}
        ${view.query.from}
        ${view.query.join}
        ${view.query.where}
        ${view.query.orderBy};
        ${view_footer};`;

        await this.runSQL_Query(config, sql_statement).then(() => {
            this.tracker_log("Created ${view.name}")
        });
    }


    //--------------------------------------------------------------------------------------------------------------------------
    // Execute a Postgres SQL query via the Hasura API
    async  runSQL_Query(config, sql_statement) {

        if (!config)
            throw ("config is required");

        if (!sql_statement)
            throw ("sql_statement is required");

        var sqlQuery = {
            type: "run_sql",
            args: {
                sql: sql_statement
            }
        };

        return await this.runGraphQL_Query(config, sqlQuery).then(results => {
            return results.data.result;
        }).catch(e => {
            this.tracker_log(config, "HASURA_AUTO_TRACKER: SQL QUERY FAILED TO EXECUTE: ");
            this.tracker_log(config, "");
            this.tracker_log(config, sql_statement);
            this.tracker_log(config, "");
            this.tracker_log(config, e);
            this.tracker_log(config, "");
        });
    }

    //--------------------------------------------------------------------------------------------------------------------------
    // Execute a GraphQL query via the Hasura API
    async  runGraphQL_Query(config, query) {

        if (!config)
            throw ("config is required");

        if (!query)
            throw ("query is required");

        return await axios
            .post(config.hasuraEndpoint, query)
            .then(result => {
                return result;
            });
    }

    tracker_log(config, text) {
        if (!config)
            throw ("config is required");

        if (config.logOutput) {
            console.log(text);
        }
    }
}

module.exports = HasuraAutoTracker;