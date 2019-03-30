
DROP SCHEMA IF EXISTS hasura_test CASCADE;
CREATE SCHEMA hasura_test;

-- ------------------------------------------------------------------------------

CREATE TABLE hasura_test.customers (
    "customer_id" integer PRIMARY KEY, 

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);


-- ------------------------------------------------------------------------------

CREATE TABLE hasura_test.device_types (
    "device_type_id" integer PRIMARY KEY,

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  

    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);


-- ------------------------------------------------------------------------------

CREATE TABLE hasura_test.device_status (
    "device_status_id" integer PRIMARY KEY,

    name character varying(32) NOT NULL,

    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);


-- ------------------------------------------------------------------------------


CREATE TABLE hasura_test.devices (
    "device_id" integer PRIMARY KEY,

    "device_type_id" integer
        REFERENCES hasura_test.device_types NOT NULL,

    "device_status_id" integer
        REFERENCES hasura_test.device_status NOT NULL,

    "customer_id" integer
        REFERENCES hasura_test.customers,

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  

    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);


-- ------------------------------------------------------------------------------

CREATE TABLE hasura_test.messages (
    "message_id" integer PRIMARY KEY,

    "device_id" integer
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
("customer_id", "name")
VALUES
(1, 'Brit Corp'),
(2, 'SpanTel'),
(3, 'Oz Grain'),
(4, 'NipponTek'),
(5, 'GasCo')
;


--
-- DEVICE TYPES
--
-- Describe the function of a device
--

INSERT INTO hasura_test.device_types
("device_type_id", "name", "description")
VALUES 
(1, 'IOT_RAIN', 'Rain gauge'),
(2, 'IOT_WS', 'Weather Station'),
(3, 'IOT_GPS', 'GPS position'),
(4, 'IOT_MR', 'Meter reading')
;


--
-- DEVICE TYPES
--
-- Describe the function of a device
--

INSERT INTO hasura_test.device_status
("device_status_id", "name")
VALUES 
(1, 'OK'),
(2, 'FAULTY')
;

--
-- DEVICES
--
-- Devices are of a specified type and belong to customers
--


INSERT INTO hasura_test.devices
("device_id", "device_type_id",  "customer_id", "device_status_id", "name","description")
VALUES 
(1,  2, 1, 1, 'UK_WS_IOT_001', 'London'),
(2,  2, 1, 2, 'UK_WS_IOT_002', 'Leeds'),
(3,  2, 1, 1, 'UK_WS_IOT_003', 'Cardiff'),
(4,  2, 1, 2, 'UK_WS_IOT_004', 'Belfast'),

(5,  2, 2, 1, 'Weather ES001', 'Madrid'),
(6,  2, 2, 2, 'Weather ES002', 'Barcelona'),
(7,  2, 2, 1, 'Weather ES003', 'Marbella'),

(8,  2, 3, 2, 'Weather AU001', 'Perth'),
(9,  2, 3, 2, 'Weather AU002', 'Sydney'),
(10, 2, 3, 1, 'Weather AU003', 'Darwin'),

(11, 2, 4, 1, 'Weather KP_TK_001', 'Tokyo'),

(12, 4, 5, 1, 'GM_AF7654321', 'Unit 1, The industrial estate, Leeds, LS1 1TJ'),
(13, 4, 5, 2, 'GM_AF1234567', 'Big CarCo, Birmingham, B21 9DF'),
(14, 4, 5, 1, 'GM_AF0010010', 'Little Cafe, Main Street, Manchester, M1 1AG')
;


--
-- MESSAGES
--
-- Messages are either received from Gateways or created by Modules
--

INSERT INTO hasura_test.messages
("message_id", "timestamp", "device_id", "payload")
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