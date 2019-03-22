
DROP SCHEMA IF EXISTS hasura_test CASCADE;
CREATE SCHEMA hasura_test;

-- ------------------------------------------------------------------------------

CREATE TABLE hasura_test.customers (
    "customerId" integer PRIMARY KEY, 

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);

-- ------------------------------------------------------------------------------

CREATE TABLE hasura_test.devices (
    "deviceId" integer PRIMARY KEY,

    "customerId" integer
        REFERENCES hasura_test.customers,

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  

    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);

-- ------------------------------------------------------------------------------

CREATE TABLE hasura_test.messages (
    "messageId" integer PRIMARY KEY,

    "deviceId" integer
            REFERENCES hasura_test.devices,

    payload JSONB NOT NULL,

    timestamp timestamp NOT NULL,

    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);
COMMENT ON TABLE hasura_test.messages IS 'Messages can be created by incoming IoT payloads or the platform when transforming messages or creating alerts and various logs';


----------------------------------------------------------------------------------------
-- TEST DATA
--
--

--
-- CUSTOMERS
--
-- Customers can be assigned to devices
--

INSERT INTO hasura_test.customers
("customerId", "name")
VALUES
(1, 'Brit Corp'),
(2, 'SpanTel'),
(3, 'Oz Grain'),
(4, 'NipponTek')
;

INSERT INTO hasura_test.devices
("deviceId", "customerId", "name","description")
VALUES (1, 1, 'Weather 1', 'London'),
(2, 1, 'Weather 2', 'Leeds'),
(3, 1, 'Weather 3', 'Cardiff'),
(4, 1, 'Weather 4', 'Belfast'),

(5, 2, 'Weather WE001', 'Madrid'),
(6, 2, 'Weather WE002', 'Barcelona'),
(7, 2, 'Weather WE003', 'Marbella'),

(8, 3, 'Weather WE003', 'Perth'),
(9, 3, 'Weather WE003', 'Sydney'),
(10, 3, 'Weather WE003', 'Darwin'),

(11, 4, 'Weather WE003', 'Tokyo')
;


--
-- MESSAGES
--
-- Messages are either received from Gateways or created by Modules
--

INSERT INTO hasura_test.messages
("messageId", "timestamp", "deviceId", "payload")
VALUES
(1,  NOW(), 1, '{ "temperature": 25.1, "humidity": 10, "windspeed": 25, "winddirection": "N" }'),
(2,  NOW(), 1, '{ "temperature": 26.8, "humidity": 20, "windspeed": 20, "winddirection": "NE" }'),
(3,  NOW(), 1, '{ "temperature": 27.3, "humidity": 30, "windspeed": 10, "winddirection": "NE" }'),
(4,  NOW(), 1, '{ "temperature": 28.5, "humidity": 40, "windspeed": 15, "winddirection": "NW" }'),
(5,  NOW(), 1, '{ "temperature": 31.2, "humidity": 50, "windspeed": 20, "winddirection": "NW" }'),

(6,  NOW(), 2, '{ "temperature": 25.1, "humidity": 10, "windspeed": 25, "winddirection": "N" }'),
(7,  NOW(), 2, '{ "temperature": 26.8, "humidity": 20, "windspeed": 20, "winddirection": "NE" }'),
(8,  NOW(), 2, '{ "temperature": 27.3, "humidity": 30, "windspeed": 10, "winddirection": "NE" }'),
(9,  NOW(), 2, '{ "temperature": 28.5, "humidity": 40, "windspeed": 15, "winddirection": "NW" }'),
(10, NOW(), 2, '{ "temperature": 31.2, "humidity": 50, "windspeed": 20, "winddirection": "NW" }'),

(11, NOW(), 3, '{ "temperature": 25.1, "humidity": 10, "windspeed": 25, "winddirection": "N" }'),
(12, NOW(), 3, '{ "temperature": 26.8, "humidity": 20, "windspeed": 20, "winddirection": "NE" }'),
(13, NOW(), 3, '{ "temperature": 27.3, "humidity": 30, "windspeed": 10, "winddirection": "NE" }'),
(14, NOW(), 3, '{ "temperature": 28.5, "humidity": 40, "windspeed": 15, "winddirection": "NW" }'),
(15, NOW(), 3, '{ "temperature": 31.2, "humidity": 50, "windspeed": 20, "winddirection": "NW" }'),

(16, NOW(), 4, '{ "temperature": 25.1, "humidity": 10, "windspeed": 25, "winddirection": "N" }'),
(17, NOW(), 5, '{ "temperature": 26.8, "humidity": 20, "windspeed": 20, "winddirection": "NE" }'),
(18, NOW(), 6, '{ "temperature": 27.3, "humidity": 30, "windspeed": 10, "winddirection": "NE" }'),
(19, NOW(), 7, '{ "temperature": 28.5, "humidity": 40, "windspeed": 15, "winddirection": "NW" }'),
(20, NOW(), 8, '{ "temperature": 31.2, "humidity": 50, "windspeed": 20, "winddirection": "NW" }')

;
