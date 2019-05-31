
----------------------------------------------------------------------------------------
-- TEST DATA
--
--


DELETE FROM public.messages;
DELETE FROM public.flows;
DELETE FROM public.devices;
DELETE FROM public.tag_definitions;
DELETE FROM public.modules;
DELETE FROM public.customers;
DELETE FROM public.settings;


--
-- CUSTOMERS
--
-- Customers can be assigned to public.devices
--

INSERT INTO public.customers
(name)
VALUES
('CBH'),
('KiwiCorp'),
('Graincorp'),
('Looseleaf')
;

--
-- public.environments
--
-- Target systems could have test and production instances, so we need a way to manage settings, grouping configuration information which is used in 
-- the different public.environments, e.g. point to a test instance of Pairtree, or a production instance etc.alter
--
-- As public.flows move through a dev test cycle, they are associated with different public.environments and connect to the correct test/prod endpoints which 
-- are specified by the environment settings
--

INSERT INTO public.environments
(name, "description")
VALUES('dev', 'Development environment'), ('test', 'Test environment'), ('prod', 'Productionenvironment');


--
-- public.modules
--
-- public.modules have a specific type, like Filter or Converter, but have more specialised configuration information, such as how to connect to Sigfox, or Pairtree.
-- In effect, a Pairtree endpoint module can be defined, and then used in public.flows. When used in a flow, only the specific connection information is required, all other
-- aspects of the module setup have been standardised.
--

INSERT INTO public.modules
(module_type_id,name,"description",default_configuration,documentation_url)
VALUES((SELECT module_type_id FROM public.module_types WHERE name='Gateway' LIMIT 1), 'Sigfox','Receive from Sigfox network',NULL,'www.axistech.co');

INSERT INTO public.modules
(module_type_id,name,"description",default_configuration,documentation_url)
VALUES((SELECT module_type_id FROM public.module_types WHERE name='Gateway' LIMIT 1), 'ThingsNetwork','Receive from Things Network',  NULL,'www.axistech.co');

INSERT INTO public.modules
(module_type_id,name,"description",default_configuration,documentation_url)
VALUES((SELECT module_type_id FROM public.module_types WHERE name='Gateway' LIMIT 1), 'Pairtree','Send to Pairtree',  NULL,'www.axistech.co');

INSERT INTO public.modules
(module_type_id,name,"description",default_configuration,documentation_url)
VALUES((SELECT module_type_id FROM public.module_types WHERE name='Endpoint' LIMIT 1), 'CBH Production Pairtree','Send to Pairtree',  NULL,'www.pairtree.com');

--
-- public.devices
--
-- public.messages are either received from Gateways or created by public.modules
--

INSERT INTO public.devices
(device_type_id,device_status_id,name,"description",customer_id,status,notes)
VALUES 
((SELECT device_type_id FROM public.device_types WHERE name='Machine Health' LIMIT 1),  (SELECT device_status_id FROM public.device_status WHERE name='Deployed' LIMIT 1), 'Harvester AN0123', (SELECT "description" FROM public.device_types WHERE name='Machine Health' LIMIT 1), (SELECT customer_id FROM public.customers WHERE name='KiwiCorp' LIMIT 1), 0, 'Here are some notes for the harvester machine monitor'),
((SELECT device_type_id FROM public.device_types WHERE name='Machine Health' LIMIT 1),  (SELECT device_status_id FROM public.device_status WHERE name='Deployed' LIMIT 1), 'Tractor AN9876', (SELECT "description" FROM public.device_types WHERE name='Machine Health' LIMIT 1), (SELECT customer_id FROM public.customers WHERE name='KiwiCorp' LIMIT 1), 0, 'Here are some notes for the tractor monitor'),
((SELECT device_type_id FROM public.device_types WHERE name='Weather Station' LIMIT 1), (SELECT device_status_id FROM public.device_status WHERE name='Deployed' LIMIT 1), 'Weather Station 1', (SELECT "description" FROM public.device_types WHERE name='Weather Station' LIMIT 1), (SELECT customer_id FROM public.customers WHERE name='CBH' LIMIT 1), 0, 'Here are some notes for weather station 1'),
((SELECT device_type_id FROM public.device_types WHERE name='Weather Station' LIMIT 1), (SELECT device_status_id FROM public.device_status WHERE name='Provisioned' LIMIT 1), 'Weather Station 2', (SELECT "description" FROM public.device_types WHERE name='Weather Station' LIMIT 1), (SELECT customer_id FROM public.customers WHERE name='Graincorp' LIMIT 1), 0, 'Here are some notes for weather station 2'),
((SELECT device_type_id FROM public.device_types WHERE name='Soil Moisture' LIMIT 1),   (SELECT device_status_id FROM public.device_status WHERE name='Provisioned' LIMIT 1), 'Soil moisture 1',   (SELECT "description" FROM public.device_types WHERE name='Soil moisture' LIMIT 1),   (SELECT customer_id FROM public.customers WHERE name='CBH' LIMIT 1), 0, 'Here are some notes for soil moisture 1'),
((SELECT device_type_id FROM public.device_types WHERE name='Soil Moisture' LIMIT 1),   (SELECT device_status_id FROM public.device_status WHERE name='Provisioned' LIMIT 1), 'Soil moisture 2',   (SELECT "description" FROM public.device_types WHERE name='Soil moisture' LIMIT 1),   (SELECT customer_id FROM public.customers WHERE name='Graincorp' LIMIT 1), 0, 'Here are some notes for soil moisture 2')
;

INSERT INTO public.devices
(device_type_id,device_status_id,name,"description",customer_id,status,notes)
VALUES 
((SELECT device_type_id FROM public.device_types WHERE name='Machine Health' LIMIT 1),  (SELECT device_status_id FROM public.device_status WHERE name='Blocked' LIMIT 1), 'Harvester BLOCKED', (SELECT "description" FROM public.device_types WHERE name='Machine Health' LIMIT 1), (SELECT customer_id FROM public.customers WHERE name='KiwiCorp' LIMIT 1), 0, 'This unknown device has been blocked'),
((SELECT device_type_id FROM public.device_types WHERE name='Machine Health' LIMIT 1),  (SELECT device_status_id FROM public.device_status WHERE name='Offline' LIMIT 1), 'Harvester OFFLINE', (SELECT "description" FROM public.device_types WHERE name='Machine Health' LIMIT 1), (SELECT customer_id FROM public.customers WHERE name='KiwiCorp' LIMIT 1), 0, 'This deployed device was taken offline'),
((SELECT device_type_id FROM public.device_types WHERE name='Weather Station' LIMIT 1), (SELECT device_status_id FROM public.device_status WHERE name='Unprovisioned' LIMIT 1), 'Weather UNPROVISIONED', (SELECT "description" FROM public.device_types WHERE name='Weather Station' LIMIT 1), (SELECT customer_id FROM public.customers WHERE name='CBH' LIMIT 1), 0, 'This weather station is unprovisioned'),
((SELECT device_type_id FROM public.device_types WHERE name='Soil Moisture' LIMIT 1),   (SELECT device_status_id FROM public.device_status WHERE name='Unprovisioned' LIMIT 1), 'Soil moisture UNPROVISIONED',   (SELECT "description" FROM public.device_types WHERE name='Soil moisture' LIMIT 1),   (SELECT customer_id FROM public.customers WHERE name='Graincorp' LIMIT 1), 0, 'This soil moisture probe is unprovisioned')
;

--
-- TEST ACK
--

INSERT INTO public.messages
(module_id,device_id, gateway_timestamp, payload, message_type_id, ackmodule_id, ack_timestamp)
VALUES
(   
	(SELECT module_id FROM public.modules WHERE name='Sigfox' LIMIT 1), 
    (SELECT public.devices.device_id FROM public.devices WHERE public.devices.name='Weather Station 1' LIMIT 1), 
    NOW(), 
    '{ "temp": 38, "humidity": 40, "windspeed": 15, "winddirection": 180 }', 
    (SELECT public.message_types.message_type_id FROM public.message_types WHERE public.message_types.name='device' LIMIT 1),
    (SELECT module_id FROM public.modules WHERE name='CBH Production Pairtree' LIMIT 1),
    NOW()
);


--
-- Flows
--
-- Flows are a group of interconnected Module Instances
--

INSERT INTO public.flows
(name,"description",canvas,environment_id,original_flow,flow_status_id)
VALUES
('default','default flow - only one flow is allowed at this time',
'{
    "name": "flow001",
    "id": "1234",
    "modules": [
        {
            "slot": 4,
            "rank": 1,
            "type": "pump",
            "name": "pump",
            "active": true
        },
        {
            "slot": 1,
            "rank": 2,
            "type": "filter",
            "name": "GPS Filter",
            "code": "",
            "active": true
        },
        {
            "slot": 1,
            "rank": 4,
            "type": "converter",
            "name": "GPS Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 1,
            "rank": 5,
            "type": "converter",
            "name": "GPS JSON Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 2,
            "rank": 2,
            "type": "filter",
            "name": "Probe FIlter",
            "code": "",
            "active": true
        },
        {
            "slot": 2,
            "rank": 4,
            "type": "converter",
            "name": "Probe Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 3,
            "rank": 5,
            "type": "converter",
            "name": "Probe JSON Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 3,
            "rank": 2,
            "type": "filter",
            "name": "Counter Filter",
            "code": "",
            "active": true
        },
        {
            "slot": 3,
            "rank": 3,
            "type": "filter",
            "name": "Rain Gauge Filter",
            "code": "",
            "active": true
        },
        {
            "slot": 3,
            "rank": 4,
            "type": "converter",
            "name": "Rain Gauge Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 3,
            "rank": 5,
            "type": "converter",
            "name": "Rain Gauge JSON Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 4,
            "rank": 2,
            "type": "filter",
            "name": "Weather Filter",
            "code": "",
            "active": true
        },
        {
            "slot": 4,
            "rank": 4,
            "type": "converter",
            "name": "Weather Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 4,
            "rank": 5,
            "type": "converter",
            "name": "Weather JSON Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 5,
            "rank": 2,
            "type": "filter",
            "name": "Windspeed Filter",
            "code": "",
            "active": true
        },
        {
            "slot": 5,
            "rank": 4,
            "type": "converter",
            "name": "Windspeed Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 6,
            "rank": 2,
            "type": "filter",
            "name": "Wind Direction Filter",
            "code": "",
            "active": true
        },
        {
            "slot": 6,
            "rank": 4,
            "type": "converter",
            "name": "Wind Direction Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 7,
            "rank": 2,
            "type": "filter",
            "name": "WaterPressure Filter",
            "code": "",
            "active": true
        },
        {
            "slot": 7,
            "rank": 4,
            "type": "converter",
            "name": "WaterPressure Converter",
            "code": "",
            "active": true
        },
        {
            "slot": 4,
            "rank": 6,
            "type": "sync",
            "name": "sync"
        }
    ],
    "connections": [
        {
            "from": "pump",
            "to": "GPS Filter"
        },
        {
            "from": "GPS Filter",
            "to": "GPS Converter"
        },
        {
            "from": "GPS Converter",
            "to": "GPS JSON Converter"
        },
        {
            "from": "GPS JSON Converter",
            "to": "sync"
        },
        {
            "from": "pump",
            "to": "Probe FIlter"
        },
        {
            "from": "Probe FIlter",
            "to": "Probe Converter"
        },
        {
            "from": "Probe Converter",
            "to": "Probe JSON Converter"
        },
        {
            "from": "Probe JSON Converter",
            "to": "sync"
        },
        {
            "from": "pump",
            "to": "Counter Filter"
        },
        {
            "from": "Counter Filter",
            "to": "Rain Gauge Filter"
        },
        {
            "from": "Rain Gauge Filter",
            "to": "Rain Gauge Converter"
        },
        {
            "from": "Rain Gauge Converter",
            "to": "Rain Gauge JSON Converter"
        },
        {
            "from": "Rain Gauge JSON Converter",
            "to": "sync"
        },
        {
            "from": "pump",
            "to": "Weather Filter"
        },
        {
            "from": "Weather Filter",
            "to": "Weather Converter"
        },
        {
            "from": "Weather Converter",
            "to": "Weather JSON Converter"
        },
        {
            "from": "Weather JSON Converter",
            "to": "sync"
        },
        {
            "from": "pump",
            "to": "Windspeed Filter"
        },
        {
            "from": "Windspeed Filter",
            "to": "Windspeed Converter"
        },
        {
            "from": "Windspeed Converter",
            "to": "sync"
        },
        {
            "from": "pump",
            "to": "Wind Direction Filter"
        },
        {
            "from": "Wind Direction Filter",
            "to": "Wind Direction Converter"
        },
        {
            "from": "Wind Direction Converter",
            "to": "sync"
        },
        {
            "from": "pump",
            "to": "WaterPressure Filter"
        },
        {
            "from": "WaterPressure Filter",
            "to": "WaterPressure Converter"
        },
        {
            "from": "WaterPressure Converter",
            "to": "sync"
        }
    ]
}',
(SELECT environment_id FROM public.environments WHERE name='dev' LIMIT 1),
NULL,
(SELECT flow_status_id FROM public.flow_status WHERE name='active' LIMIT 1)
);