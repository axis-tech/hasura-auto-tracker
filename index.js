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
        if (!config)
            throw ("config is required");

        // Refer to the documentation - the defauly expectation is that primary / foreign key names are suffixed with _id
        // The suffix (e.g. '_id') is removed and the remaining text is used in naming relationships
        if (!config.primaryKeySuffix) {
            config.primaryKeySuffix = "_id";
        }

        if (!config.functionAndClause) {
            config.functionAndClause = '';
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
        this.tracker_log(config, "Additional Function filter : " + (config.functionAndClause == '' ? "Not set" : config.functionAndClause));
        this.tracker_log(config, "");
        this.tracker_log(config, "--------------------------------------------------------------");
        this.tracker_log(config, "");


        if (!config.getArrayRelationshipName) {
            config.getArrayRelationshipName = this.defaultArrayRelationshipName;
        }

        if (!config.getObjectRelationshipName) {
            config.getObjectRelationshipName = this.defaultObjectRelationshipName;
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
 JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND kcu.constraint_schema = '${config.targetSchema}'
 JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = '${config.targetSchema}'
 WHERE constraint_type = 'FOREIGN KEY' 
 AND tc.table_schema = '${config.targetSchema}'
 ;`;

        const function_sql =
            `
SELECT functions.routine_name 
FROM   information_schema.routines functions
WHERE  functions.routine_type='FUNCTION' 
AND    functions.specific_schema='${config.targetSchema}'
${config.functionAndClause}
;`;

        const check_schema =
            `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${config.targetSchema}';`

        await this.runSQL_Query(config, check_schema)
            .then((results) => {
                var schema = results.map(t => t[0]).splice(1);

                if (schema.length == 1)
                    return;

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

                throw config.targetSchema + " - schema does not exist";
            });

        if (config.operations.untrack) {

            await this.runSQL_Query(config, table_sql)
                .then(async (results) => {

                    var tables = results
                        .map(t => t[0])
                        .splice(1);

                    // --------------------------------------------------------------------------------------------------------------------------
                    // Drop tracking information for all tables / views, this will also untrack any relationships
                    await this.untrackTables(config, tables);
                });

            await this.runSQL_Query(config, function_sql)
                .then(async (results) => {

                    var functions = results
                        .map(t => t[0])
                        .splice(1);

                    // --------------------------------------------------------------------------------------------------------------------------
                    // Drop tracking information for functions
                    await this.untrackFunctions(config, functions);
                });
        }

        // --------------------------------------------------------------------------------------------------------------------------
        // Create SQL views, these scripts can also flatten JSON values to SQL columns
        if (config.views) {
            await this.generateViews(config, config.views);
        }

        if (config.operations.trackFunctions) {
            await this.runSQL_Query(config, function_sql)
                .then(async (results) => {

                    var functions = results
                        .map(t => t[0])
                        .splice(1);

                    // --------------------------------------------------------------------------------------------------------------------------
                    // Configure HASURA to track functions
                    await this.trackFunctions(config, functions);
                });
        }

        if (config.operations.trackTables) {
            await this.runSQL_Query(config, table_sql)
                .then(async (results) => {

                    var tables = results
                        .map(t => t[0])
                        .splice(1);

                    // --------------------------------------------------------------------------------------------------------------------------
                    // Configure HASURA to track all TABLES and VIEWS - tables and views are added to the GraphQL schema automatically
                    await this.trackTables(config, tables);
                });
        }

        if (config.operations.trackRelationships) {

            // Create the list of relationships required by foreign keys
            await this.runSQL_Query(config, foreignKey_sql)
                .then(async (results) => {

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
                    await this.trackRelationships(config, foreignKeys);
                    this.tracker_log(config, "");
                });

        }
    }

    // Setup of relationship naming should be done before execution of the auto tracker
    //#region Relationship naming

    //---------------------------------------------------------------------------------------------------------------------------
    // If foreign key name and primary key are same, then use the table name as relationship name
    UseCompactRelationshipNaming(config) {
        if (!config)
            throw ("config is required");

        config.getArrayRelationshipName = this.compactArrayRelationshipName;
        config.getObjectRelationshipName = this.compactObjectRelationshipName;
        config.runNameProcessors = this.runNameProcessors;

        if (!config.nameProcessors)
            config.nameProcessors = [];

        config.nameProcessors.push(this.singularName);
        config.nameProcessors.push(this.camelCaseName);
    }


    //---------------------------------------------------------------------------------------------------------------------------
    // If foreign key name and primary key are same, then use the table name as relationship name
    UseDefaultRelationshipNaming(config) {
        if (!config)
            throw ("config is required");

        config.getArrayRelationshipName = this.defaultArrayRelationshipName;
        config.getObjectRelationshipName = this.defaultObjectRelationshipName;
    }


    //---------------------------------------------------------------------------------------------------------------------------
    // Provide more succinct relationship names
    compactArrayRelationshipName(config, relationship) {
        if (!config)
            throw ("config is required");

        if (!relationship)
            throw ("relationship is required");

        var name;

        if (relationship.key1 === relationship.key2)
            name = relationship.table1;
        else
            name = relationship.key1.replace(config.primaryKeySuffix, "") + "_" + relationship.table1;

        return config.runNameProcessors ? config.runNameProcessors(config, name, false) : name;
    }


    //---------------------------------------------------------------------------------------------------------------------------
    // Provide more succinct relationship names
    compactObjectRelationshipName(config, relationship) {
        if (!config)
            throw ("config is required");

        if (!relationship)
            throw ("config is required");

        var name;

        if (relationship.key1 === relationship.key2)
            name = relationship.table2;
        else
            name = relationship.table1 + "_" + relationship.key1.replace(config.primaryKeySuffix, "");

        return config.runNameProcessors ? config.runNameProcessors(config, name, true) : name;
    }


    //---------------------------------------------------------------------------------------------------------------------------
    // Default relationship name builder
    defaultArrayRelationshipName(config, relationship) {
        if (!config)
            throw ("config is required");

        return relationship.key1.replace(config.primaryKeySuffix, "") + "_" + relationship.table1;
    }


    //---------------------------------------------------------------------------------------------------------------------------
    // Default relationship name builder
    defaultObjectRelationshipName(config, relationship) {
        if (!config)
            throw ("config is required");

        return relationship.table1 + "_" + relationship.key1.replace(config.primaryKeySuffix, "");
    }

    //---------------------------------------------------------------------------------------------------------------------------
    // convert foreign_key_names into foreignKeyName
    camelCaseName(inputString) {
        if (!inputString)
            throw ("inputString is required");

        var text = inputString.toLowerCase()
            .replace(/[_-]/g, " ") // Break up the words in my_foreign_key_name to be like my foreign key name
            .replace(/\s[a-z]/g, (s) => s.toUpperCase()) // capitalise each word
            .replace(" ", "") // remove the space to join the words back together
            .replace(/^[A-Z]/, (s) => s.toLowerCase()) // ensure the first word is lowercased
            ;

        return text;
    }

    //---------------------------------------------------------------------------------------------------------------------------
    // handle plural words which can easily be singularised 
    singularName(inputString, singular) {
        if (!inputString)
            throw ("inputString is required");

        var text = inputString;

        // If the singular form of the name is required then use some simple logic to get the singular form
        // If the logic doesn't work, just return whatever text was created above
        if (singular) {

            if (["ies"].indexOf(text.slice(text.length - 3)) >= 0) {
                text = text.slice(0, text.length - 3) + "y";
            }
            else if (["us", "ss"].indexOf(text.slice(text.length - 2)) < 0) {
                if (text.slice(text.length - 1) == "s") {
                    text = text.slice(0, text.length - 1);
                }
            }
        }

        return text;
    }


    //---------------------------------------------------------------------------------------------------------------------------
    // Run the collection of name processors to refine the name of the relationship
    runNameProcessors(config, name, singular) {
        if (!config)
            throw ("config is required");

        if (!name)
            throw ("name is required");

        for (const processor of config.nameProcessors)
            name = processor(name, singular);

        return name;
    }


    //#endregion


    //#region Function Tracking

    // --------------------------------------------------------------------------------------------------------------------------
    // Configure HASURA to track functions
    async untrackFunctions(config, functions) {
        if (!config)
            throw ("config is required");

        this.tracker_log(config, "");
        this.tracker_log(config, "REMOVE PREVIOUS HASURA TRACKING DETAILS FOR FUNCTIONS");

        functions.map(async (function_name) => {
            this.tracker_log(config, "    UNTRACK FUNCTION - " + function_name);

            var query = {
                type: "untrack_function",
                args: {
                    schema: config.targetSchema,
                    name: function_name
                }
            };

            await this.runGraphQL_Query(config, query)
                .catch(e => {
                    if (e.response.data.error.includes("function not found in cache")) {
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
    async trackFunctions(config, functions) {
        if (!config)
            throw ("config is required");

        this.tracker_log(config, "");
        this.tracker_log(config, "CONFIGURE HASURA FUNCTION TRACKING");

        functions.map(async (function_name) => {
            this.tracker_log(config, "    TRACK FUNCTION - " + function_name);

            var query = {
                type: "track_function",
                args: {
                    schema: config.targetSchema,
                    name: function_name
                }
            };

            await this.runGraphQL_Query(config, query)
                .catch(e => {
                    if (e.response.data.error.includes("already tracked")) {
                        return;
                    }

                    if (e.response.data.error.includes("not return a ")) {
                        this.tracker_log(config, "");
                        this.tracker_log(config, "");
                        this.tracker_log(config, "--------------------------------------------------------------");
                        this.tracker_log(config, ""); this.tracker_log(config, "ERROR TRACKING FUNCTION : '" + function_name + "'");
                        this.tracker_log(config, "");
                        this.tracker_log(config, "Error Message - Functions must return COMPOSITE type. Refer to Hasura documentation.");
                        this.tracker_log(config, "");
                    }
                    else {

                        this.tracker_log(config, "");
                        this.tracker_log(config, "");
                        this.tracker_log(config, "--------------------------------------------------------------");
                        this.tracker_log(config, ""); this.tracker_log(config, "GRAPHQL QUERY FAILED TO EXECUTE: ");
                        this.tracker_log(config, "");
                        this.tracker_log(config, JSON.stringify(query));
                        this.tracker_log(config, "");
                        this.tracker_log(config, "EXCEPTION DETAILS - creating " + currentRelationshipType + " - " + currentRelationshipName);
                        this.tracker_log(config, "");
                        this.tracker_log(config, e.response.request.data);
                        this.tracker_log(config, "");
                    }

                    throw e.response.request.data
                });;
        });
    }

    //#endregion


    //#region Table Tracking

    // --------------------------------------------------------------------------------------------------------------------------
    // Configure HASURA to track all tables and views in the specified schema -> 'HASURA_AUTO_TRACKER'
    async untrackTables(config, tables) {
        if (!config)
            throw ("config is required");

        this.tracker_log(config, "REMOVE PREVIOUS HASURA TRACKING DETAILS FOR TABLES AND VIEWS");

        tables.map(async (table_name) => {
            this.tracker_log(config, "    UNTRACK TABLE - " + table_name);

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

            await this.runGraphQL_Query(config, query)
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
    async trackTables(config, tables) {
        if (!config)
            throw ("config is required");

        this.tracker_log(config, "");
        this.tracker_log(config, "CONFIGURE HASURA TABLE/VIEW TRACKING");

        tables.map(async (table_name) => {
            this.tracker_log(config, "    TRACK TABLE        - " + table_name);

            var query = {
                type: "track_table",
                args: {
                    schema: config.targetSchema,
                    name: table_name
                }
            };

            await this.runGraphQL_Query(config, query).catch(e => {

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

    //#endregion


    //#region Relationship Tracking

    // --------------------------------------------------------------------------------------------------------------------------
    // Configure HASURA to track all relationships
    // This requires an array relationship in one direction and an object relationship in the opposite direction
    async trackRelationships(config, relationships) {
        if (!config)
            throw ("config is required");

        if ((!config.primaryKeySuffix || config.primaryKeySuffix.trim() == "") &&
            (!config.getArrayRelationshipName || !getObjectRelationshipName)
        ) {
            throw "'config.primaryKeySuffix' is not specified. Both config.getArrayRelationshipName and config.getObjectRelationshipName are required.";
        }

        this.tracker_log(config, "");
        this.tracker_log(config, "CONFIGURE HASURA RELATIONSHIP TRACKING");

        relationships.map(async (relationship) => {
            await this.createRelationships(config, relationship);
        });
    }

    // --------------------------------------------------------------------------------------------------------------------------
    // It is possible to pass in two functions, which should generate the name of the relationship:
    // getArrayRelationshipName - Must return a string, used as the name of array relationships
    // getObjectRelationshipName - Must return a string, used as the name of object relationships
    async createRelationships(config, relationship) {
        if (!config)
            throw ("config is required");

        if (relationship.addArrayRelationship) {
            const array_rel_spec = {
                type: "create_array_relationship",
                name: relationship.name ? relationship.name : config.getArrayRelationshipName(config, relationship),
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
                name: relationship.name ? relationship.name : config.getObjectRelationshipName(config, relationship),
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
    async createRelationship(config, relSpec) {
        if (!config)
            throw ("config is required");

        this.tracker_log(config, "    TRACK RELATIONSHIP - " + relSpec.type + " : " + relSpec.srcTable + "->" + relSpec.name);

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

        await this.runGraphQL_Query(config, hasuraApiRelationshipType)
            .catch(e => {

                if (e.response.data.error.includes("already exists")) {
                    return;
                }

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

    //#endregion


    //#region View Generation

    //--------------------------------------------------------------------------------------------------------------------------
    // Create Postgres views that flatten JSON payloads into SQL columns
    async generateViews(config) {
        if (!config)
            throw ("config is required");

        // --------------------------------------------------------------------------------------------------------------------------
        // Execute SQL scripts required before view creation
        if (config.scripts && config.scripts.beforeViews) {
            this.executeScripts(config, config.scripts.beforeViews);
        }

        this.tracker_log(config, "CREATE SQL VIEWS");

        config.views.map((view) => {
            this.generateView(config, view);
        });

        // --------------------------------------------------------------------------------------------------------------------------
        // Execute SQL scripts required after view creation
        if (config.scripts && config.scripts.afterViews) {
            await this.executeScripts(config, config.scripts.afterViews);
        }
    }


    //--------------------------------------------------------------------------------------------------------------------------
    // Create the view: DROP if exists, create view, add comment to view
    async generateView(config, view) {
        if (!config)
            throw ("config is required");

        this.tracker_log(config, "    CREATE VIEW - " + view.name);

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

        await this.runSQL_Query(config, sql_statement)
            .then(() => {
                this.tracker_log("Created ${view.name}")
            });
    }

    //#endregion


    //#region Hasura API Calls

    //--------------------------------------------------------------------------------------------------------------------------
    // Execute a list of SQL scripts
    async executeScripts(config, scripts) {
        if (!config)
            throw ("config is required");

        this.tracker_log(config, "");
        this.tracker_log(config, "EXECUTE SQL SCRIPTS");

        scripts.map(async (s) => {

            var content = fs.readFileSync(s.source, { encoding: "utf8" });
            this.tracker_log(config, "    EXECUTE SQL SCRIPT - " + s.source);

            if (content.trim().length > 0) {
                await this.runSQL_Query(config, content);
            }

        });

        this.tracker_log(config, "");
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

                if (!e.response)
                    this.tracker_log(config, "Error Message : " + e);
                else
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
    async runGraphQL_Query(config, query) {
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

        return await axios.post(config.hasuraEndpoint, query, requestConfig)
            .then(result => {
                return result;
            });
    }

    //#endregion


    //#region Utilities

    //--------------------------------------------------------------------------------------------------------------------------
    // Write log text if output is requested by the config
    tracker_log(config, text) {
        if (!config)
            throw ("config is required");

        if (config.logOutput) {
            console.log(text);
        }
    }

    //#endregion
}

module.exports = HasuraAutoTracker;
