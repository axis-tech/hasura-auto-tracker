CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_with_oids = false;

-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.message_types CASCADE;
DROP TABLE IF EXISTS public.flows CASCADE;
DROP TABLE IF EXISTS public.flow_status CASCADE;
DROP TABLE IF EXISTS public.tag_definitions CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.device_types CASCADE;
DROP TABLE IF EXISTS public.device_status CASCADE;
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TABLE IF EXISTS public.module_types CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.environments CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

CREATE TABLE public.environments (
    environment_id uuid primary key default public.uuid_generate_v4(),
    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.environments OWNER TO postgres;
COMMENT ON TABLE public.environments IS 'Represents the various lifecycle environments from developments through to production';

-- ------------------------------------------------------------------------------

CREATE TABLE public.settings (
    setting_id uuid primary key default public.uuid_generate_v4(),
    environment_id uuid NOT NULL
            REFERENCES public.environments,

    key character varying(512) DEFAULT ''::character varying NOT NULL,
    value text DEFAULT ''::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.settings OWNER TO postgres;
COMMENT ON TABLE public.settings IS 'Contains system  settings required by a specific environment';

-- ------------------------------------------------------------------------------

CREATE TABLE public.customers (
    customer_id uuid primary key default public.uuid_generate_v4(), 
    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);

ALTER TABLE public.customers OWNER TO postgres;
COMMENT ON TABLE public.customers IS 'Basic customer details, which can be referenced by devices';

-- ------------------------------------------------------------------------------

CREATE TABLE public.device_types (
    device_type_id uuid primary key default public.uuid_generate_v4(),
    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);

ALTER TABLE public.device_types OWNER TO postgres;
COMMENT ON TABLE public.device_types IS 'Basic description of a device and sensors which it comprises';

-- ------------------------------------------------------------------------------

CREATE TABLE public.device_status (
    device_status_id uuid primary key default public.uuid_generate_v4(),
    
    name character varying(32) NOT NULL,
    
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.device_status OWNER TO postgres;
COMMENT ON TABLE public.device_status IS 'Used to indicate the status of a device';

-- ------------------------------------------------------------------------------

CREATE TABLE public.devices (
    device_id uuid primary key default public.uuid_generate_v4(),

    customer_id uuid
        REFERENCES public.customers,
    
    device_type_id uuid NOT NULL
        REFERENCES public.device_types,
    
    device_status_id uuid NOT NULL
        REFERENCES public.device_status,

    status_message character varying(32) NOT NULL DEFAULT 'Ok',

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    notes character varying(256),
    status bigint DEFAULT 0 NOT NULL,

    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.devices OWNER TO postgres;
COMMENT ON TABLE public.devices IS 'IoT device package details, which are sources of messages';

-- ------------------------------------------------------------------------------

CREATE TABLE public.tag_definitions (
    tag_definition_id uuid primary key default public.uuid_generate_v4(),
    parent_id uuid
            REFERENCES public.tag_definitions,

    device_id uuid
            REFERENCES public.devices,

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.tag_definitions OWNER TO postgres;
COMMENT ON TABLE public.tag_definitions IS 'Hierarchival tags which can be applied to devices';

-- ------------------------------------------------------------------------------

CREATE TABLE public.module_types (
    module_type_id uuid primary key default public.uuid_generate_v4(),
    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    flow_occurences character varying(1) DEFAULT ''::character varying NOT NULL,
    inputs character varying(1) DEFAULT ''::character varying NOT NULL,
    outputs character varying(1) DEFAULT ''::character varying NOT NULL,
    default_configuration JSONB,
    documentation_url character varying(512),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.module_types OWNER TO postgres;
COMMENT ON TABLE public.module_types IS 'Type descriptor which is used to classify modules, which process messages';

-- ------------------------------------------------------------------------------

CREATE TABLE public.modules (
    module_id uuid primary key default public.uuid_generate_v4(),
    module_type_id uuid NOT NULL
                REFERENCES public.module_types,

    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    documentation_url character varying(512),
    default_configuration  JSONB,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.modules OWNER TO postgres;
COMMENT ON TABLE public.modules IS 'Modules process messages on the platform, generally moving messages from inputs to outputs';

-- ------------------------------------------------------------------------------

CREATE TABLE public.message_types (
    message_type_id uuid primary key default public.uuid_generate_v4(),
    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.message_types OWNER TO postgres;
COMMENT ON TABLE public.message_types IS 'Classification applied to messages';

-- ------------------------------------------------------------------------------

CREATE TABLE public.messages (
    message_id uuid primary key default public.uuid_generate_v4(),
    message_type_id uuid NOT NULL
            REFERENCES public.message_types,

    parent_message_id uuid NULL
            REFERENCES public.messages,

    device_id uuid
            REFERENCES public.devices,

    module_id uuid
            REFERENCES public.modules,

    ackmodule_id uuid
            REFERENCES public.modules,

    group_id uuid NULL, 
    payload JSONB NOT NULL,
    gateway_timestamp timestamp without time zone,
    ack_timestamp timestamp without time zone,

    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.messages OWNER TO postgres;
COMMENT ON TABLE public.messages IS 'Messages can be created by incoming IoT payloads or the platform when transforming messages or creating alerts and various logs';

-- ------------------------------------------------------------------------------

CREATE TABLE public.flow_status (
    flow_status_id uuid primary key default public.uuid_generate_v4(),
    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.flow_status OWNER TO postgres;
COMMENT ON TABLE public.message_types IS 'Status of flows';

-- ------------------------------------------------------------------------------

CREATE TABLE public.flows (
    flow_id uuid primary key default public.uuid_generate_v4(),
    flow_status_id uuid NOT NULL
            REFERENCES public.flow_status,

    environment_id uuid NOT NULL
            REFERENCES public.environments,

    original_flow uuid,
    name character varying(32) NOT NULL,
    description character varying(256) DEFAULT ''::character varying ,  
   
    canvas  JSONB NOT NULL,
    
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);
ALTER TABLE public.flows OWNER TO postgres;
COMMENT ON TABLE public.flows IS 'Flows are a network of connected modules which take messages from the store and push them through a defined process';




----------------------------------------------------------------------------------------
-- Get the ID of the last message to be received for a device where the message was
-- created in the last 30 seconds
--


CREATE OR REPLACE FUNCTION PUBLIC.get_last_message_id_for_device(
	dev_id uuid
)
RETURNS uuid AS
$func$
DECLARE 
group_id uuid;
BEGIN
 	SELECT  message_id
  		FROM public.messages messages
		INNER JOIN public.devices devices ON devices.device_id = messages.device_id
  	WHERE messages.gateway_timestamp > (NOW() -  interval '30 seconds')
  		AND devices.device_id = dev_id
	LIMIT 1
  	INTO group_id;
	RETURN group_id;
END;
$func$
LANGUAGE plpgsql;

----------------------------------------------------------------------------------------
-- For all rows inserted into messages, set the group_id appropriately
--

CREATE OR REPLACE FUNCTION public.set_message_group_id()
  RETURNS trigger AS
$BODY$
DECLARE gid uuid;
BEGIN
 	gid := (SELECT public.get_last_message_id_for_device(NEW.device_id));
	
	IF gid ISNULL
    THEN
		NEW.group_id = (SELECT public.uuid_generate_v4());
	ELSE
		NEW.group_id = gid;
	END IF;

 RETURN NEW;
END;
$BODY$
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_message_group_id on public.messages;

CREATE  TRIGGER assign_message_group_id
  BEFORE INSERT
  ON public.messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_message_group_id();


----------------------------------------------------------------------------------------
-- REFERENCE DATA
--
--

--
-- ENVIRONMENTS
--
-- Target systems could have test and production instances, so we need a way to manage settings, grouping configuration information which is used in 
-- the different environments, e.g. point to a test instance of Pairtree, or a production instance etc.alter
--
-- As flows move through a dev test cycle, they are associated with different environments and connect to the correct test/prod endpoints which 
-- are specified by the environment settings
--

INSERT INTO public.environments
(name, description)
VALUES('dev', 'Development environment'), ('test', 'Test environment'), ('prod', 'Productionenvironment');


--
-- MODULE TYPES
--
-- Basic module types are used to standardise gateway, filter, converter and endpoint modules
--

INSERT INTO public.module_types
(name,description, flow_occurences, inputs, outputs, documentation_url, default_configuration)
VALUES
('UI', 'Axisflow User Interface', '0', '0', '0',  'www.axistech.co', NULL),
('Gateway', 'Gateway Module', '1', '0', '1',  'www.axistech.co', '{"type": "Gateway"}'),
('Filter', 'Filter Module', '+', '+', '+',  'www.axistech.co', '{"type": "Filter"}'),
('Converter', 'Converter Module', '+', '+', '+',  'www.axistech.co', '{"type": "Converter"}'),
('Endpoint', 'Endpoint Module', '+', '+', '0',  'www.axistech.co', '{"type": "Endpoint"}');


--
-- MODULES
--
-- Modules have a specific type, like Filter or Converter, but have more specialised configuration information, such as how to connect to Sigfox, or Pairtree.
-- In effect, a Pairtree endpoint module can be defined, and then used in flows. When used in a flow, only the specific connection information is required, all other
-- aspects of the module setup have been standardised.
--

INSERT INTO public.modules
(module_type_id,name,description,default_configuration,documentation_url)
VALUES((SELECT module_type_id FROM public.module_types WHERE name='UI' LIMIT 1), 'User Interface','Axisflow User Interface',NULL,'www.axistech.co');

INSERT INTO public.modules
(module_type_id,name,description,default_configuration,documentation_url)
VALUES((SELECT module_type_id FROM public.module_types WHERE name='Gateway' LIMIT 1), 'Intermediate Module','Execute Javascript',NULL,'www.axistech.co');

--
-- DEVICE STATUS
--
-- Defines the current known condition of a device
--


INSERT INTO public.device_status
(name)
VALUES
('Unprovisioned'),
('Blocked'),
('Provisioned'),
('Offline'),
('Deployed')
;

--
-- DEVICE TYPES
--
-- Defines known device types which can comprise multiple sensors
--

INSERT INTO public.device_types
(name, description)
VALUES
('Machine Health', 'AxisTech Machine Monitor'),
('Weather Station', 'AxisTech Weather Station'),
('Soil Moisture', 'AxisTech Soil Moisture'),
('Light Level', 'AxisTech Light Level');


--
-- MESSAGE TYPES
--
-- Messages have a type which enables them to be classified
--

INSERT INTO public.message_types
(name)
VALUES 
('device'),
('transformation'),
('alert'),
('information'),
('simulation'),
('error');


--
-- FLOW STATUS
--
-- Defines the status of flows so they can be marked in design, ready for execution etc.
--


INSERT INTO public.flow_status
(name)
VALUES
('design'),
('active'),
('paused'),
('inactive');
