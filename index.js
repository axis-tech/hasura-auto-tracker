const axios = require("axios");

//
// The purpose of this code is to allow the caller to track all Postgres tables, views and relationships with a single call
// which goes to support continuous integration as you no longer have to use the Hasura UI to click the buttons to track all tables/relationships.
//
// The code also creates SQL views which can translate JSON values into SQL data columns
//

const fs = require('fs');

class HasuraAutoTracker {

    //---------------------------------------------------------------------------------------------------------------------------
    // Default constructor
    constructor() { }


    //---------------------------------------------------------------------------------------------------------------------------
    // Entry point
    async ExecuteHasuraAutoTracker(config) {
        // Refer to the documentation - the defauly expectation is that primary / foreign key names are suffixed with _id
        // The suffix (e.g. '_id') is removed and the remaining text is used in naming relationships
        if (!config.primaryKeySuffix) {
            config.primaryKeySuffix = "_id";
        }

        this.tracker_log(config, "--------------------------------------------------------------");
        this.tracker_log(config, "");
        this.tracker_log(config, "       hasura-auto-tracker : Auto-configuration for Hasura");
        this.tracker_log(config, "");
        this.tracker_log(config, "        SCHEMA             : '" + config.targetSchema + "'");
        this.tracker_log(config, "        HASURA ENDPOINT    : '" + config.hasuraEndpoint + "'");
        this.tracker_log(config, "        PRIMARY KEY SUFFIX : '" + config.primaryKeySuffix + "'");
        this.tracker_log(config, "");
        this.tracker_log(config, " Array relationship naming : " + (config.getArrayRelationshipName ? "Custom" : "Default"));
        this.tracker_log(config, "Object relationship naming : " + (config.getObjectRelationshipName ? "Custom" : "Default"));
        this.tracker_log(config, "");
        this.tracker_log(config, "--------------------------------------------------------------");
        this.tracker_log(config, "");

        if (!config.getArrayRelationshipName) {
            config.getArrayRelationshipName = this.createDefaultArrayRelationshipName;
        }

        if (!config.getObjectRelationshipName) {
            config.getObjectRelationshipName = this.createDefaultObjectRelationshipName;
        }


        // --------------------------------------------------------------------------------------------------------------------------
        // SQL to acquire metadata

        const table_sql =
            `
 SELECT table_name FROM information_schema.tables WHERE table_schema = '${config.targetSchema}'
 UNION
 SELECT table_name FROM information_schema.views WHERE table_schema = '${config.targetSchema}'
 ORDER BY table_name;
 `;

        const foreignKey_sql =
            `
 SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
 FROM information_schema.table_constraints AS tc
 JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
 JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
 WHERE constraint_type = 'FOREIGN KEY'
 AND tc.constraint_schema = '${config.targetSchema}';
 `;

        const check_schema =
            `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${config.targetSchema}';`

        await this.runSQL_Query(config, check_schema)
            .then((results) => {
                var schema = results.map(t => t[0]).splice(1);

                this.tracker_log(config, "");
                this.tracker_log(config, "");
                this.tracker_log(config, "--------------------------------------------------------------");
                this.tracker_log(config, "");
                this.tracker_log(config, "HASURA_AUTO_TRACKER: ERROR");
                this.tracker_log(config, "");
                this.tracker_log(config, "TARGET SCHEMA DOES NOT EXIST");
                this.tracker_log(config, "");
                this.tracker_log(config, "Target Schema : " + config.targetSchema);
                this.tracker_log(config, "");
                this.tracker_log(config, "Check the configuration script and ensure the schema exists in the database");
                this.tracker_log(config, "");
                this.tracker_log(config, "--------------------------------------------------------------");

                if (schema.length != 1)
                    throw config.targetSchema + " - schema does not exist";
            });


        // --------------------------------------------------------------------------------------------------------------------------
        // Create SQL views, these scripts can also flatten JSON values to SQL columns
        if (config.views) {
            this.generateViews(config, config.views);
        }

        if (config.operations.untrack) {

            await this.runSQL_Query(config, table_sql)
                .then((results) => {

                    var tables = results
                        .map(t => t[0])
                        .splice(1);

                    // --------------------------------------------------------------------------------------------------------------------------
                    // Drop tracking information for all tables / views, this will also untrack any relationships
                    this.untrackTables(config, tables);
                });
        }

        if (config.operations.trackTables) {
            await this.runSQL_Query(config, table_sql)
                .then((results) => {

                    var tables = results
                        .map(t => t[0])
                        .splice(1);

                    // --------------------------------------------------------------------------------------------------------------------------
                    // Configure HASURA to track all TABLES and VIEWS - tables and views are added to the GraphQL schema automatically
                    this.trackTables(config, tables);
                });
        }

        if (config.operations.trackRelationships) {

            // Create the list of relationships required by foreign keys
            await this.runSQL_Query(config, foreignKey_sql)
                .then((results) => {
                    var foreignKeys = results.splice(1)
                        .map(fk => {
                            return {
                                table1: fk[0],
                                key1: fk[1],
                                table2: fk[2],
                                key2: fk[3],
                                addArrayRelationship: true,
                                addObjectRelationship: true
                            };
                        });

                    // Add relationships required from the additional SQL views
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
                    this.trackRelationships(config, foreignKeys);
                    this.tracker_log(config, "");
                });

        }
    }


    //---------------------------------------------------------------------------------------------------------------------------
    // Default relationship name builders
    createDefaultArrayRelationshipName(config, relationship) {
        return relationship.key1.replace(config.primaryKeySuffix, "") + "_" + relationship.table1;
    }


    createDefaultObjectRelationshipName(config, relationship) {
        return relationship.table1 + "_" + relationship.key1.replace(config.primaryKeySuffix, "");
    }


    // --------------------------------------------------------------------------------------------------------------------------
    // Configure HASURA to track all tables and views in the specified schema -> 'HASURA_AUTO_TRACKER'
    untrackTables(config, tables) {

        this.tracker_log(config, "REMOVE PREVIOUS HASURA TRACKING DETAILS");
        this.tracker_log(config, "");

        tables.map((table_name) => {
            this.tracker_log(config, "UNTRACKING - " + table_name);

            var query = {
                type: "untrack_table",
                args: {
                    table: {
                        schema: config.targetSchema,
                        name: table_name
                    },
                    cascade: true
                }
            };

            this.runGraphQL_Query(config, query)
                .catch(e => {
                    if (e.response.data.error.includes("already untracked")) {
                        return;
                    }

                    this.tracker_log(config, "");
                    this.tracker_log(config, "");
                    this.tracker_log(config, "--------------------------------------------------------------");
                    this.tracker_log(config, "");
                    this.tracker_log(config, "HASURA_AUTO_TRACKER: ERROR");
                    this.tracker_log(config, "");
                    this.tracker_log(config, "GRAPHQL QUERY FAILED TO EXECUTE");
                    this.tracker_log(config, "");
                    this.tracker_log(config, "Error Message : " + e.response.data.internal.error.message);
                    this.tracker_log(config, e.response.request.data);
                    this.tracker_log(config, "");
                    this.tracker_log(config, "Query:");
                    this.tracker_log(config, "");
                    this.tracker_log(config, JSON.stringify(query));
                    this.tracker_log(config, "");
                    this.tracker_log(config, "Are Hasura and the database fully initialised?");
                    this.tracker_log(config, "");
                    this.tracker_log(config, "--------------------------------------------------------------");
                });;
        });
    }


    // --------------------------------------------------------------------------------------------------------------------------
    // Configure HASURA to track all tables and views in the specified schema -> 'HASURA_AUTO_TRACKER'
    trackTables(config, tables) {
        this.tracker_log(config, "");
        this.tracker_log(config, "CONFIGURE HASURA TABLE/VIEW TRACKING");
        this.tracker_log(config, "");

        tables.map((table_name) => {
            this.tracker_log(config, "TRACKING - " + table_name);

            var query = {
                type: "track_table",
                args: {
                    schema: config.targetSchema,
                    name: table_name
                }
            };

            return this.runGraphQL_Query(config, query).catch(e => {

                if (e.response.data.error.includes("already tracked")) {
                    return;
                }

                this.tracker_log(config, "GRAPHQL QUERY FAILED TO EXECUTE: ");
                this.tracker_log(config, "");
                this.tracker_log(config, JSON.stringify(query));
                this.tracker_log(config, "");
                this.tracker_log(config, "EXCEPTION DETAILS - creating " + currentRelationshipType + " - " + currentRelationshipName);
                this.tracker_log(config, "");
                this.tracker_log(config, e.response.request.data);
                this.tracker_log(config, "");
            });;
        });
    }


    // --------------------------------------------------------------------------------------------------------------------------
    // Configure HASURA to track all relationships
    // This requires an array relationship in one direction and an object relationship in the opposite direction
    trackRelationships(config, relationships) {

        if ((!config.primaryKeySuffix || config.primaryKeySuffix.trim() == "") &&
            (!config.getArrayRelationshipName || !getObjectRelationshipName)
        ) {
            throw "'config.primaryKeySuffix' is not specified. Both config.getArrayRelationshipName and config.getObjectRelationshipName are required.";
        }

        this.tracker_log(config, "");
        this.tracker_log(config, "CONFIGURE HASURA RELATIONSHIP TRACKING");
        this.tracker_log(config, "");

        relationships.map((relationship) => {
            this.createRelationships(config, relationship);
        });
    }

    // --------------------------------------------------------------------------------------------------------------------------
    // It is possible to pass in two functions, which should generate the name of the relationship:
    // getArrayRelationshipName - Must return a string, used as the name of array relationships
    // getObjectRelationshipName - Must return a string, used as the name of object relationships
    createRelationships(config, relationship) {

        if (relationship.addArrayRelationship) {
            const array_rel_spec = {
                type: "create_array_relationship",

                name: relationship.name ? relationship.name : config.getArrayRelationshipName(config, relationship),

                srcTable: relationship.table2,
                srcKey: relationship.key2,
                destTable: relationship.table1,
                destKey: relationship.key1
            };

            this.createRelationship(config, array_rel_spec);
        }

        if (relationship.addObjectRelationship) {
            const obj_rel_spec = {
                type: "create_object_relationship",

                name: relationship.name ? relationship.name : config.getObjectRelationshipName(config, relationship),

                srcTable: relationship.table1,
                srcKey: relationship.key1,
                destTable: relationship.table2,
                destKey: relationship.key2
            };

            this.createRelationship(config, obj_rel_spec);
        }
    }

    // --------------------------------------------------------------------------------------------------------------------------
    // Create the specified relationship
    createRelationship(config, relSpec) {
        this.tracker_log(config, "TRACKING RELATIONSHIP - " + relSpec.type + " name:" + relSpec.name);
        //        this.tracker_log(config, "                      - " + relSpec.srcTable + "." + relSpec.srcKey + " -> " + relSpec.destTable + "." + relSpec.destKey);
        //        this.tracker_log(config, "");

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

        this.runGraphQL_Query(config, hasuraApiRelationshipType).catch(e => {

            //            if (e.response.data.error.includes("already exists")) {
            //                return;
            //            }

            this.tracker_log(config, "GRAPHQL QUERY FAILED TO EXECUTE: ");
            this.tracker_log(config, "");
            this.tracker_log(config, JSON.stringify(hasuraApiRelationshipType));
            this.tracker_log(config, "");
            this.tracker_log(config, "EXCEPTION DETAILS - creating " + relSpec.type + " - " + relSpec.name);
            this.tracker_log(config, "");
            this.tracker_log(config, e.response.data);
            this.tracker_log(config, "");
        });
    }


    //--------------------------------------------------------------------------------------------------------------------------
    // Create Postgres views that flatten JSON payloads into SQL columns
    generateViews(config) {

        // --------------------------------------------------------------------------------------------------------------------------
        // Execute SQL scripts required before view creation
        if (config.scripts && config.scripts.beforeViews) {
            this.executeScripts(config, config.scripts.beforeViews);
        }

        this.tracker_log(config, "CREATE SQL VIEWS FOR MESSAGE PAYLOADS");

        config.views.map((view) => {
            this.generateView(config, view);
        });

        this.tracker_log(config, "");

        // --------------------------------------------------------------------------------------------------------------------------
        // Execute SQL scripts required after view creation
        if (config.scripts && config.scripts.afterViews) {
            this.executeScripts(config, config.scripts.afterViews);
        }
    }


    //--------------------------------------------------------------------------------------------------------------------------
    // Execute a list of SQL scripts
    executeScripts(config, scripts) {

        scripts.map((s) => {

            var content = fs.readFileSync(s.source, { encoding: "utf8" });
            this.tracker_log(config, "EXECUTE SQL SCRIPT - " + s.source);

            if (content.trim().length > 0) {
                this.runSQL_Query(config, content);
            }

        });

        this.tracker_log(config, "");
    }


    //--------------------------------------------------------------------------------------------------------------------------
    // Create the view: DROP if exists, create view, add comment to view
    generateView(config, view) {
        this.tracker_log(config, "CREATE VIEW - " + view.name);

        if (view.relationships) {
            view.relationships.map(relationship => {
                config.relationships.push({ ...relationship, srcTable: view.name });
            });
        }

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
            var view_columns = ","

            view.columns.jsonValues.map(col => {
                view_columns +=
                    `
CAST(${view.columns.jsonColumn} ->> '${col.jsonName}' AS ${col.sqlType}) AS "${col.sqlName}",`;
            });

        }

        var sql_statement = `
 ${view_header}
 ${view.query.select.trim().replace(/,\s*$/, "")}
 ${view_columns.trim().replace(/,\s*$/, "")}
 ${view.query.from}
 ${view.query.join}
 ${view.query.where}
 ${view.query.orderBy};
 ${view_footer};`;

        this.runSQL_Query(config, sql_statement)
            .then(() => {
                this.tracker_log("Created ${view.name}")
            });
    }


    //--------------------------------------------------------------------------------------------------------------------------
    // Execute a Postgres SQL query via the Hasura API
    async runSQL_Query(config, sql_statement) {

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

        return await this.runGraphQL_Query(config, sqlQuery)
            .then(results => {
                return results.data.result;
            }).catch(e => {
                this.tracker_log(config, "");
                this.tracker_log(config, "");
                this.tracker_log(config, "--------------------------------------------------------------");
                this.tracker_log(config, "");
                this.tracker_log(config, "HASURA_AUTO_TRACKER: ERROR");
                this.tracker_log(config, "");
                this.tracker_log(config, "SQL QUERY FAILED TO EXECUTE: ");
                this.tracker_log(config, "");
                this.tracker_log(config, "Error Message : " + e.response.data.internal.error.message);
                this.tracker_log(config, "");
                this.tracker_log(config, "SQL Statement:");
                this.tracker_log(config, "");
                this.tracker_log(config, sql_statement);
                this.tracker_log(config, "");
                this.tracker_log(config, "Check for SQL syntax errors. Test the query in your admin tool.");
                this.tracker_log(config, "");
                this.tracker_log(config, "--------------------------------------------------------------");
            });
    }


    //--------------------------------------------------------------------------------------------------------------------------
    // Execute a GraphQL query via the Hasura API
    runGraphQL_Query(config, query) {

        if (!config)
            throw ("config is required");

        if (!query)
            throw ("query is required");

        let requestConfig = { };

        if (config.hasuraAdminSecret) {
            requestConfig = {
                ...requestConfig,
                headers: {
                    'X-Hasura-Admin-Secret': config.hasuraAdminSecret,
                },
            };
        }

        return axios.post(config.hasuraEndpoint, query, requestConfig)
            .then(result => {
                return result;
            });
    }


    //--------------------------------------------------------------------------------------------------------------------------
    // Write log text if output is requested by the config
    tracker_log(config, text) {
        if (!config)
            throw ("config is required");

        if (config.logOutput) {
            console.log(text);
        }
    }
}

module.exports = HasuraAutoTracker;
