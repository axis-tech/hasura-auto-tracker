-- ------------------------------------------------------------------------------

CREATE TABLE customers (
    "customer_id" integer PRIMARY KEY, 

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);


-- ------------------------------------------------------------------------------

CREATE TABLE device_types (
    "device_type_id" integer PRIMARY KEY,

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  

    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);


-- ------------------------------------------------------------------------------

CREATE TABLE device_status (
    "device_status_id" integer PRIMARY KEY,

    name character varying(32) NOT NULL,

    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);


-- ------------------------------------------------------------------------------


CREATE TABLE devices (
    "device_id" integer PRIMARY KEY,

    "device_type_id" integer
        REFERENCES device_types NOT NULL,

    "device_status_id" integer
        REFERENCES device_status NOT NULL,

    "customer_id" integer
        REFERENCES customers,

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  

    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);


-- ------------------------------------------------------------------------------

CREATE TABLE messages (
    "message_id" integer PRIMARY KEY,

    "device_id" integer
            REFERENCES devices,

    payload JSONB NOT NULL,

    timestamp timestamp NOT NULL,

    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone
);
COMMENT ON TABLE messages IS 'Messages can be created by incoming IoT payloads or the platform when transforming messages or creating alerts and various logs';


----------------------------------------------------------------------------------------
-- TEST DATA
--
--

--
-- CUSTOMERS
--
-- Customers can be assigned to devices
--

INSERT INTO customers
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

INSERT INTO device_types
("device_type_id", "name", "description")
VALUES 
(1, 'IOT_RAIN', 'Rain gauge'),
(2, 'IOT_WEATHER', 'Weather'),
(3, 'IOT_GPS', 'GPS location'),
(4, 'IOT_MR', 'Meter reading')
;


--
-- DEVICE TYPES
--
-- Describe the function of a device
--

INSERT INTO device_status
("device_status_id", "name")
VALUES 
(1, 'OK'),
(2, 'FAULT')
;

--
-- DEVICES
--
-- Devices are of a specified type and belong to customers
--


INSERT INTO devices
("device_id", "device_type_id",  "customer_id", "device_status_id", "name","description")
VALUES 
(1,  2, 1, 1, 'UK_IOT_001', 'London'),
(2,  2, 1, 2, 'UK_IOT_002', 'Leeds'),
(3,  2, 1, 1, 'UK_IOT_003', 'Cardiff'),
(4,  2, 1, 2, 'UK_IOT_004', 'Belfast'),

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

INSERT INTO messages
("message_id", "timestamp", "device_id", "payload")
VALUES
(1,  NOW(), 1, '{ "temp": 25.1, "rel_hum": 10, "wind_speed": 25, "wind_dir": "N" }'),
(2,  NOW(), 1, '{ "temp": 26.8, "rel_hum": 20, "wind_speed": 20, "wind_dir": "NE" }'),
(3,  NOW(), 1, '{ "temp": 27.3, "rel_hum": 30, "wind_speed": 10, "wind_dir": "NE" }'),
(4,  NOW(), 1, '{ "temp": 28.5, "rel_hum": 40, "wind_speed": 15, "wind_dir": "NW" }'),
(5,  NOW(), 1, '{ "temp": 31.2, "rel_hum": 50, "wind_speed": 20, "wind_dir": "NW" }'),

(6,  NOW(), 2, '{ "temp": 25.1, "rel_hum": 10, "wind_speed": 25, "wind_dir": "N" }'),
(7,  NOW(), 2, '{ "temp": 26.8, "rel_hum": 20, "wind_speed": 20, "wind_dir": "NE" }'),
(8,  NOW(), 2, '{ "temp": 27.3, "rel_hum": 30, "wind_speed": 10, "wind_dir": "NE" }'),
(9,  NOW(), 2, '{ "temp": 28.5, "rel_hum": 40, "wind_speed": 15, "wind_dir": "NW" }'),
(10, NOW(), 2, '{ "temp": 31.2, "rel_hum": 50, "wind_speed": 20, "wind_dir": "NW" }'),

(11, NOW(), 3, '{ "temp": 25.1, "rel_hum": 10, "wind_speed": 25, "wind_dir": "N" }'),
(12, NOW(), 3, '{ "temp": 26.8, "rel_hum": 20, "wind_speed": 20, "wind_dir": "NE" }'),
(13, NOW(), 3, '{ "temp": 27.3, "rel_hum": 30, "wind_speed": 10, "wind_dir": "NE" }'),
(14, NOW(), 3, '{ "temp": 28.5, "rel_hum": 40, "wind_speed": 15, "wind_dir": "NW" }'),
(15, NOW(), 3, '{ "temp": 31.2, "rel_hum": 50, "wind_speed": 20, "wind_dir": "NW" }'),

(16, NOW(), 4, '{ "temp": 25.1, "rel_hum": 10, "wind_speed": 25, "wind_dir": "N" }'),
(17, NOW(), 5, '{ "temp": 26.8, "rel_hum": 20, "wind_speed": 20, "wind_dir": "NE" }'),
(18, NOW(), 6, '{ "temp": 27.3, "rel_hum": 30, "wind_speed": 10, "wind_dir": "NE" }'),
(19, NOW(), 7, '{ "temp": 28.5, "rel_hum": 40, "wind_speed": 15, "wind_dir": "NW" }'),
(20, NOW(), 8, '{ "temp": 31.2, "rel_hum": 50, "wind_speed": 20, "wind_dir": "NW" }')
;