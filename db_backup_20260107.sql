--
-- PostgreSQL database dump
--

\restrict z5DwV940eF5KnjD3Td7tCxr7l77Wx6jZ2MRygKRvS8CvL9oBGWMOnfXoBffgLAI

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public._prisma_migrations VALUES ('c42fcd87-3e01-4dd9-b80b-221eb53b0679', '675559bb3b3b70a53243572211146dd544180adde778bc6c4c5d4b1e088293de', '2026-01-06 07:47:10.601651+00', '20260106074710_init_base_tables', NULL, NULL, '2026-01-06 07:47:10.457797+00', 1);
INSERT INTO public._prisma_migrations VALUES ('ba8c89e1-8548-4d09-9977-1840b5d397a9', '75d1d71ba01fbeb05928f463353abf4640f4c6f8e0cac106d6c98289dd586c5a', '2026-01-06 08:39:58.881592+00', '20260106083908_add_marketing_contact_submissions', NULL, NULL, '2026-01-06 08:39:58.864413+00', 1);
INSERT INTO public._prisma_migrations VALUES ('2aacb1bc-d1ee-459a-a2f9-80d29f85003b', 'f8b1c2f7a5bfcf41d1a24e76ef173c8d467c08b13a498d272366e33ffcdb02d9', '2026-01-06 09:26:37.275125+00', '20260106092637_add_marketing_submissions', NULL, NULL, '2026-01-06 09:26:37.251176+00', 1);
INSERT INTO public._prisma_migrations VALUES ('9ca488bc-c1b1-447c-9a95-f4eff024304f', '06d0eab5dea1d91b87d1f0ed3f4481a3e8ab4b20ade9a63c1a990726afa7b1a1', '2026-01-06 09:41:17.219695+00', '20260106094117_cp48_provisioning_setup_wizard', NULL, NULL, '2026-01-06 09:41:17.174153+00', 1);


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.organizations VALUES ('6948223f-e8f7-43e9-abf9-eef6358d9fde', 'Test Law Firm', 'test-law-firm', 'active', 'America/New_York', '2026-01-06 08:03:31.191', '2026-01-06 08:03:31.191', NULL, 'not_started', NULL, NULL, 'manual');
INSERT INTO public.organizations VALUES ('01cd30e7-388c-4b83-b9c7-fd29f0921b91', 'Smoke Test Org 1767700854523', 'smoke-test-org-1767700854523', 'active', 'America/New_York', '2026-01-06 12:00:54.576', '2026-01-06 12:00:54.576', NULL, 'not_started', NULL, NULL, 'manual');
INSERT INTO public.organizations VALUES ('b5612572-44f4-4cf8-9669-bfb948879453', 'Smoke Test Org 1767700976270', 'smoke-test-org-1767700976270', 'active', 'America/New_York', '2026-01-06 12:02:56.306', '2026-01-06 12:02:56.306', NULL, 'not_started', NULL, NULL, 'manual');
INSERT INTO public.organizations VALUES ('f28745ea-373c-450a-98b5-871a14aa85d1', 'Smoke Test Org 1767702413684', 'smoke-test-org-1767702413684', 'active', 'America/New_York', '2026-01-06 12:26:53.728', '2026-01-06 12:26:53.728', NULL, 'not_started', NULL, NULL, 'manual');
INSERT INTO public.organizations VALUES ('e552396a-e129-4a16-aa24-a016f9dcaba3', 'Demo Law Firm', 'demo-law-firm', 'active', 'America/Chicago', '2026-01-06 07:51:31.637', '2026-01-06 17:59:24.765', '2026-01-06 17:59:24.763', 'complete', NULL, NULL, 'manual');
INSERT INTO public.organizations VALUES ('test-org-openai-sim-001', 'TEST ORG - OPENAI SIM', 'test-org-openai-sim', 'active', 'America/New_York', '2026-01-07 08:08:07.307', '2026-01-07 08:08:07.307', NULL, 'complete', NULL, NULL, 'active');


--
-- Data for Name: ai_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.ai_configs VALUES ('5f5e8139-642e-4b71-9d77-23d8e25ed29c', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'Thank you for calling Demo Law Firm. My name is Alex, and I''m an AI assistant here to help you with your legal matter. How can I assist you today?', 'Please note that I am an AI assistant and cannot provide legal advice. Our conversation will be recorded and reviewed by our legal team. If this is an emergency, please hang up and dial 911.', '{"style": "empathetic"}', '{"businessHours": {"end": "17:00", "start": "09:00"}, "afterHoursBehavior": "ai_agent"}', '{"followUp": {"autoFollowUp": true, "delayMinutes": 20}}', '2026-01-06 07:51:32.141', '2026-01-06 17:59:15.275');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES ('13177319-776d-48b0-9888-bf8a39cc96ed', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'owner@demo.com', 'Demo Owner', 'owner', 'active', '$2b$12$hzsaYxBsPqdSqniYakL74eQEKALRk7kbcKRZPPHAVr5hckN3cYlWW', '2026-01-06 07:51:32.077', '2026-01-06 07:51:32.077', NULL);
INSERT INTO public.users VALUES ('0fe111fc-f15a-41d7-9338-59198f5c1ece', '6948223f-e8f7-43e9-abf9-eef6358d9fde', 'newowner@test.com', 'Test Owner', 'owner', 'active', '$2b$12$uB86FKwnH88I/n1riIT1gOIS9D./spf07FNaKqW7zz./A1EY3tYTS', '2026-01-06 08:03:31.612', '2026-01-06 08:03:31.612', NULL);
INSERT INTO public.users VALUES ('3cd94044-9693-4baa-8ea5-a7cadb6b7cda', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', 'smoketest1767700854523@test.com', 'Smoke Test User', 'owner', 'active', '$2b$12$Mr3X4NRM4P1OVkbDcwqR/uBJpHMgKqTISuYrGgJA4mfmVT2Ty5zCi', '2026-01-06 12:00:55.065', '2026-01-06 12:00:55.065', NULL);
INSERT INTO public.users VALUES ('12391265-b750-433c-9a5f-eba6b83a48d7', 'b5612572-44f4-4cf8-9669-bfb948879453', 'smoketest1767700976270@test.com', 'Smoke Test User', 'owner', 'active', '$2b$12$tFrxyBbko1Q.onTQDUzl5OVtU5bksYB9XFhvfDnECLtFKADuPTM3O', '2026-01-06 12:02:56.694', '2026-01-06 12:02:56.694', NULL);
INSERT INTO public.users VALUES ('336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'f28745ea-373c-450a-98b5-871a14aa85d1', 'smoketest1767702413684@test.com', 'Smoke Test User', 'owner', 'active', '$2b$12$JrDtiw2jfKd5bgbl9222x.gkJyXASXFArKX0YdmZEnRFClJ5u8k92', '2026-01-06 12:26:54.165', '2026-01-06 12:26:54.165', NULL);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.audit_logs VALUES ('67374d22-e666-4f62-b2bd-779aee80cb8c', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T08:03:18.750Z"}', '2026-01-06 08:03:18.755');
INSERT INTO public.audit_logs VALUES ('7266627e-0bf1-4631-a5e6-6d35d761192e', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T08:03:29.520Z"}', '2026-01-06 08:03:29.522');
INSERT INTO public.audit_logs VALUES ('3c6b8727-6630-4f18-8266-c4fcb2d9c7d4', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'update', 'organization', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '{"changes": {"timezone": "America/Chicago"}, "timestamp": "2026-01-06T08:03:29.646Z"}', '2026-01-06 08:03:29.647');
INSERT INTO public.audit_logs VALUES ('718e19cb-ec16-42fe-aa3a-44baf9668bd0', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T08:05:33.125Z"}', '2026-01-06 08:05:33.134');
INSERT INTO public.audit_logs VALUES ('30c05b54-2b67-4f56-92e5-392c05b18583', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T08:10:00.690Z"}', '2026-01-06 08:10:00.697');
INSERT INTO public.audit_logs VALUES ('680fa725-5db3-43ea-8dd0-03d807318ae3', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'create', 'contact', 'e680d2d1-bc52-4586-948f-2329451bf9e0', '{"name": "John Smith", "timestamp": "2026-01-06T08:10:00.772Z"}', '2026-01-06 08:10:00.774');
INSERT INTO public.audit_logs VALUES ('9c8b3e5e-b4a3-4686-9a84-00d658c1cff2', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'create', 'lead', '563674fa-228e-4680-9597-a4f72fed1936', '{"source": "phone", "contactId": "e680d2d1-bc52-4586-948f-2329451bf9e0", "timestamp": "2026-01-06T08:10:00.888Z"}', '2026-01-06 08:10:00.889');
INSERT INTO public.audit_logs VALUES ('2b4795a3-f116-4083-87a2-bf37aec85c16', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T08:10:13.280Z"}', '2026-01-06 08:10:13.282');
INSERT INTO public.audit_logs VALUES ('17374f4b-6851-440c-b74b-d7849f9fc766', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'update', 'lead', '563674fa-228e-4680-9597-a4f72fed1936', '{"changes": {"status": "contacted", "summary": "Client confirmed accident details"}, "timestamp": "2026-01-06T08:10:13.384Z"}', '2026-01-06 08:10:13.385');
INSERT INTO public.audit_logs VALUES ('ae344669-fedb-4e6a-a1e6-1f72aa169076', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T08:10:28.740Z"}', '2026-01-06 08:10:28.741');
INSERT INTO public.audit_logs VALUES ('22fa0fef-79d4-475a-8ce2-f2f1a6da90f4', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'create', 'contact', 'd34e29c6-2240-41b1-af5f-4d9d9fe4a704', '{"name": "Jane Doe", "timestamp": "2026-01-06T08:10:28.784Z", "createdViaLead": true}', '2026-01-06 08:10:28.785');
INSERT INTO public.audit_logs VALUES ('a317f09d-cf61-4105-b08b-d819c2a9dc7c', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'create', 'lead', '5d2d4389-dc34-4576-92eb-7a7d64f1724e', '{"source": "web", "contactId": "d34e29c6-2240-41b1-af5f-4d9d9fe4a704", "timestamp": "2026-01-06T08:10:28.796Z"}', '2026-01-06 08:10:28.797');
INSERT INTO public.audit_logs VALUES ('fbab0b50-6d83-4cc2-999d-af8ba8fbfd6d', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T08:12:10.035Z"}', '2026-01-06 08:12:10.041');
INSERT INTO public.audit_logs VALUES ('86595987-471b-4d6b-8c84-a87329ef9ade', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T08:20:52.043Z"}', '2026-01-06 08:20:52.051');
INSERT INTO public.audit_logs VALUES ('022ba3b2-6589-40dc-9af8-22f4dfd02bff', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T08:52:20.406Z"}', '2026-01-06 08:52:20.408');
INSERT INTO public.audit_logs VALUES ('0d30693e-f300-4e6a-85b8-404f8185ffbb', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '3cd94044-9693-4baa-8ea5-a7cadb6b7cda', 'user', 'create', 'contact', 'a8d4b6fd-99e7-4590-855a-60342a675e2f', '{"name": "John Smoke", "timestamp": "2026-01-06T12:00:55.111Z"}', '2026-01-06 12:00:55.115');
INSERT INTO public.audit_logs VALUES ('98f488c7-4b5e-4315-8555-7a6234cebbb7', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '3cd94044-9693-4baa-8ea5-a7cadb6b7cda', 'user', 'create', 'lead', 'e16b0f2e-4f81-44bc-9da2-b723ebf4b18e', '{"source": "smoke_test", "contactId": "a8d4b6fd-99e7-4590-855a-60342a675e2f", "timestamp": "2026-01-06T12:00:55.158Z"}', '2026-01-06 12:00:55.159');
INSERT INTO public.audit_logs VALUES ('0fd79c8f-0452-482e-b722-3406adf28658', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '3cd94044-9693-4baa-8ea5-a7cadb6b7cda', 'user', 'intake_initialized', 'intake', '55aad2ad-78e5-49a3-9fba-ec2b02cf2b32', '{"leadId": "e16b0f2e-4f81-44bc-9da2-b723ebf4b18e", "questionSetId": null, "practiceAreaId": null}', '2026-01-06 12:00:55.187');
INSERT INTO public.audit_logs VALUES ('978b516c-54e4-449f-a12c-8eab0da92405', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '3cd94044-9693-4baa-8ea5-a7cadb6b7cda', 'user', 'intake_updated', 'intake', '55aad2ad-78e5-49a3-9fba-ec2b02cf2b32', '{"leadId": "e16b0f2e-4f81-44bc-9da2-b723ebf4b18e", "updatedFields": ["incidentDate", "incidentLocation", "injuries"]}', '2026-01-06 12:00:55.212');
INSERT INTO public.audit_logs VALUES ('95d7cf9c-1c59-4629-9f49-f981e4d6e086', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '3cd94044-9693-4baa-8ea5-a7cadb6b7cda', 'user', 'intake_completed', 'intake', '55aad2ad-78e5-49a3-9fba-ec2b02cf2b32', '{"leadId": "e16b0f2e-4f81-44bc-9da2-b723ebf4b18e", "answersCount": 3}', '2026-01-06 12:00:55.238');
INSERT INTO public.audit_logs VALUES ('a235b194-e6a4-48c8-afc3-e077c471ddb1', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '3cd94044-9693-4baa-8ea5-a7cadb6b7cda', 'user', 'qualification_run', 'qualification', '615fc640-96b6-4a55-9630-cd55ccbc461f', '{"score": 45, "leadId": "e16b0f2e-4f81-44bc-9da2-b723ebf4b18e", "confidence": 40, "disposition": "review", "factorCount": 2}', '2026-01-06 12:00:55.315');
INSERT INTO public.audit_logs VALUES ('ad62db1a-e301-4cec-adc9-146b14425070', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '3cd94044-9693-4baa-8ea5-a7cadb6b7cda', 'user', 'webhook.create', 'webhook_endpoint', 'e969577f-3d0c-4649-97d0-254cfbfa20bd', '{"url": "https://httpbin.org/post", "events": ["lead.created", "intake.completed"]}', '2026-01-06 12:00:55.354');
INSERT INTO public.audit_logs VALUES ('0eb58d67-2221-42b2-9db4-7b8ce2a5d795', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '3cd94044-9693-4baa-8ea5-a7cadb6b7cda', 'user', 'experiment.create', 'experiment', '7d87453a-6355-4387-938f-f5bc8186cf58', '{"kind": "intake_script", "name": "Smoke Test Experiment"}', '2026-01-06 12:00:55.377');
INSERT INTO public.audit_logs VALUES ('4ab9c2f2-bca4-4005-a2c9-d8b81e2a9b72', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '3cd94044-9693-4baa-8ea5-a7cadb6b7cda', 'user', 'experiment.start', 'experiment', '7d87453a-6355-4387-938f-f5bc8186cf58', '{}', '2026-01-06 12:00:55.395');
INSERT INTO public.audit_logs VALUES ('46b1660e-68f2-4f55-abee-7a711bd4c648', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '3cd94044-9693-4baa-8ea5-a7cadb6b7cda', 'user', 'policy_test.run', 'policy_test_suite', '879585ea-3b34-4cf9-9e46-043643e35603', '{"runId": "f5570be2-519a-4cdb-af1a-19fa796cb160", "status": "failed", "failedCount": 1, "passedCount": 1}', '2026-01-06 12:00:55.466');
INSERT INTO public.audit_logs VALUES ('ab32ee62-9102-4032-8f73-5b02517f2b44', 'b5612572-44f4-4cf8-9669-bfb948879453', '12391265-b750-433c-9a5f-eba6b83a48d7', 'user', 'create', 'contact', 'f5492642-563e-4107-99ae-aefc576dca2a', '{"name": "John Smoke", "timestamp": "2026-01-06T12:02:56.731Z"}', '2026-01-06 12:02:56.733');
INSERT INTO public.audit_logs VALUES ('0f6042dd-701d-4b2c-b894-c0a929f88e94', 'b5612572-44f4-4cf8-9669-bfb948879453', '12391265-b750-433c-9a5f-eba6b83a48d7', 'user', 'create', 'lead', 'e34ad302-d978-45c5-b216-fc3ff2f7abe5', '{"source": "smoke_test", "contactId": "f5492642-563e-4107-99ae-aefc576dca2a", "timestamp": "2026-01-06T12:02:56.766Z"}', '2026-01-06 12:02:56.767');
INSERT INTO public.audit_logs VALUES ('83ad6a45-3e95-4e2a-be26-3565ba4ade09', 'b5612572-44f4-4cf8-9669-bfb948879453', '12391265-b750-433c-9a5f-eba6b83a48d7', 'user', 'intake_initialized', 'intake', '318c76e7-6807-4823-8e08-997b19e2148f', '{"leadId": "e34ad302-d978-45c5-b216-fc3ff2f7abe5", "questionSetId": null, "practiceAreaId": null}', '2026-01-06 12:02:56.801');
INSERT INTO public.audit_logs VALUES ('3593b289-4c0f-4aed-bc4f-57b16fde1157', 'b5612572-44f4-4cf8-9669-bfb948879453', '12391265-b750-433c-9a5f-eba6b83a48d7', 'user', 'intake_updated', 'intake', '318c76e7-6807-4823-8e08-997b19e2148f', '{"leadId": "e34ad302-d978-45c5-b216-fc3ff2f7abe5", "updatedFields": ["incidentDate", "incidentLocation", "injuries"]}', '2026-01-06 12:02:56.833');
INSERT INTO public.audit_logs VALUES ('0269bf47-83e0-4f14-9f02-1e3a1cc0e7b9', 'b5612572-44f4-4cf8-9669-bfb948879453', '12391265-b750-433c-9a5f-eba6b83a48d7', 'user', 'intake_completed', 'intake', '318c76e7-6807-4823-8e08-997b19e2148f', '{"leadId": "e34ad302-d978-45c5-b216-fc3ff2f7abe5", "answersCount": 3}', '2026-01-06 12:02:56.855');
INSERT INTO public.audit_logs VALUES ('a46d24e3-2d31-4a90-85d2-1ee178fbca28', 'b5612572-44f4-4cf8-9669-bfb948879453', '12391265-b750-433c-9a5f-eba6b83a48d7', 'user', 'qualification_run', 'qualification', '1c75c084-fcec-42fb-9c2b-a396a0d0f1d1', '{"score": 45, "leadId": "e34ad302-d978-45c5-b216-fc3ff2f7abe5", "confidence": 40, "disposition": "review", "factorCount": 2}', '2026-01-06 12:02:56.894');
INSERT INTO public.audit_logs VALUES ('9554c0e8-a1a3-44b3-a6bf-c9a1dca9dd43', 'b5612572-44f4-4cf8-9669-bfb948879453', '12391265-b750-433c-9a5f-eba6b83a48d7', 'user', 'webhook.create', 'webhook_endpoint', '9be1edd7-8ab6-4cf7-a3f1-eb5242f26688', '{"url": "https://httpbin.org/post", "events": ["lead.created", "intake.completed"]}', '2026-01-06 12:02:56.91');
INSERT INTO public.audit_logs VALUES ('7e948894-f7a6-4e27-95e0-6fcc9124d8ee', 'b5612572-44f4-4cf8-9669-bfb948879453', '12391265-b750-433c-9a5f-eba6b83a48d7', 'user', 'experiment.create', 'experiment', '27b9b3c4-6173-405c-bf5d-ce226b3e97ac', '{"kind": "intake_script", "name": "Smoke Test Experiment"}', '2026-01-06 12:02:56.932');
INSERT INTO public.audit_logs VALUES ('240236de-e946-4d3e-8c83-2b9cb4130d46', 'b5612572-44f4-4cf8-9669-bfb948879453', '12391265-b750-433c-9a5f-eba6b83a48d7', 'user', 'experiment.start', 'experiment', '27b9b3c4-6173-405c-bf5d-ce226b3e97ac', '{}', '2026-01-06 12:02:56.945');
INSERT INTO public.audit_logs VALUES ('862346eb-0d8a-4e71-b1a3-376505566364', 'b5612572-44f4-4cf8-9669-bfb948879453', '12391265-b750-433c-9a5f-eba6b83a48d7', 'user', 'policy_test.run', 'policy_test_suite', '7b085574-d94b-4428-b92c-1f369b830d6f', '{"runId": "e95caeba-1137-4c40-a476-c2eb691c61ae", "status": "failed", "failedCount": 1, "passedCount": 1}', '2026-01-06 12:02:57.009');
INSERT INTO public.audit_logs VALUES ('bf849d08-ced7-49c6-a237-626247e88f10', 'f28745ea-373c-450a-98b5-871a14aa85d1', '336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'user', 'create', 'contact', 'c8c7a832-1091-4822-833b-7fc0da1b040b', '{"name": "John Smoke", "timestamp": "2026-01-06T12:26:54.209Z"}', '2026-01-06 12:26:54.211');
INSERT INTO public.audit_logs VALUES ('aef48f74-4536-49b2-89a0-3254996ace80', 'f28745ea-373c-450a-98b5-871a14aa85d1', '336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'user', 'create', 'lead', '6741b526-a91d-4035-a38e-14c7492651fd', '{"source": "smoke_test", "contactId": "c8c7a832-1091-4822-833b-7fc0da1b040b", "timestamp": "2026-01-06T12:26:54.247Z"}', '2026-01-06 12:26:54.248');
INSERT INTO public.audit_logs VALUES ('b54a113c-7e8a-4755-84e4-7e6062f2e60b', 'f28745ea-373c-450a-98b5-871a14aa85d1', '336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'user', 'intake_initialized', 'intake', '0c24d67b-e85b-44fa-89c0-62bbde625be4', '{"leadId": "6741b526-a91d-4035-a38e-14c7492651fd", "questionSetId": null, "practiceAreaId": null}', '2026-01-06 12:26:54.292');
INSERT INTO public.audit_logs VALUES ('fbc06c7d-10f6-4330-b019-1993a098b935', 'f28745ea-373c-450a-98b5-871a14aa85d1', '336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'user', 'intake_updated', 'intake', '0c24d67b-e85b-44fa-89c0-62bbde625be4', '{"leadId": "6741b526-a91d-4035-a38e-14c7492651fd", "updatedFields": ["incidentDate", "incidentLocation", "injuries"]}', '2026-01-06 12:26:54.348');
INSERT INTO public.audit_logs VALUES ('2efbfda5-8db9-4966-bbc2-da8ece70916b', 'f28745ea-373c-450a-98b5-871a14aa85d1', '336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'user', 'intake_completed', 'intake', '0c24d67b-e85b-44fa-89c0-62bbde625be4', '{"leadId": "6741b526-a91d-4035-a38e-14c7492651fd", "answersCount": 3}', '2026-01-06 12:26:54.376');
INSERT INTO public.audit_logs VALUES ('6774857b-8de0-466a-986e-75aca7ecf782', 'f28745ea-373c-450a-98b5-871a14aa85d1', '336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'user', 'qualification_run', 'qualification', '736cf681-6480-465f-81d4-b2216cae93ec', '{"score": 45, "leadId": "6741b526-a91d-4035-a38e-14c7492651fd", "confidence": 40, "disposition": "review", "factorCount": 2}', '2026-01-06 12:26:54.412');
INSERT INTO public.audit_logs VALUES ('aa67f6d7-018c-466e-96cd-7c3a70937423', 'f28745ea-373c-450a-98b5-871a14aa85d1', '336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'user', 'webhook.create', 'webhook_endpoint', '67ab5ddb-35c3-4de4-85ed-61b889b7d8b0', '{"url": "https://httpbin.org/post", "events": ["lead.created", "intake.completed"]}', '2026-01-06 12:26:54.426');
INSERT INTO public.audit_logs VALUES ('06bbceb0-58ad-4e97-aa37-bb04a2edf423', 'f28745ea-373c-450a-98b5-871a14aa85d1', '336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'user', 'experiment.create', 'experiment', 'e8d9d959-d386-4a63-a96d-70abbf7a2756', '{"kind": "intake_script", "name": "Smoke Test Experiment"}', '2026-01-06 12:26:54.444');
INSERT INTO public.audit_logs VALUES ('a3dd53cd-84d6-4b97-9d53-3f3a1f2c6d03', 'f28745ea-373c-450a-98b5-871a14aa85d1', '336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'user', 'experiment.start', 'experiment', 'e8d9d959-d386-4a63-a96d-70abbf7a2756', '{}', '2026-01-06 12:26:54.455');
INSERT INTO public.audit_logs VALUES ('e210483a-5418-4495-a96c-0f355a7272d7', 'f28745ea-373c-450a-98b5-871a14aa85d1', '336efc63-fccc-4a8d-8e78-888c5d6cd0a7', 'user', 'policy_test.run', 'policy_test_suite', 'd6de63b3-3010-44bb-9123-94513fc8ce2c', '{"runId": "f30d0fc0-be65-4809-93bb-2732e38d2f24", "status": "failed", "failedCount": 1, "passedCount": 1}', '2026-01-06 12:26:54.525');
INSERT INTO public.audit_logs VALUES ('ee6cc53d-c12d-4f2a-b95a-6f43f7163b20', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T17:57:43.152Z"}', '2026-01-06 17:57:43.158');
INSERT INTO public.audit_logs VALUES ('c72949f3-096e-4013-a183-45cabe4f68f3', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'update_basics', 'organization', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '{"name": "Demo Law Firm", "timezone": "America/Chicago"}', '2026-01-06 17:57:58.565');
INSERT INTO public.audit_logs VALUES ('f8953f8e-96e7-46b9-b520-570e49e4d290', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'update_business_hours', 'ai_config', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '{"businessHours": {"end": "17:00", "start": "09:00"}}', '2026-01-06 17:58:06.274');
INSERT INTO public.audit_logs VALUES ('2feea1e3-d004-4b3f-a029-c4d6e0ba2229', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'update_practice_areas', 'organization', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '{"count": 2}', '2026-01-06 17:58:14.977');
INSERT INTO public.audit_logs VALUES ('59ad487c-b23b-47a9-8eae-66753fb4c296', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'update_ai_config', 'ai_config', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '{}', '2026-01-06 17:58:58.435');
INSERT INTO public.audit_logs VALUES ('94662433-3aab-4c15-b7e4-648e20f4f48b', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'update_follow_up', 'ai_config', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '{}', '2026-01-06 17:59:15.312');
INSERT INTO public.audit_logs VALUES ('9c5c43e2-c8e1-4c75-b4fc-aaadb846760d', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'complete_onboarding', 'organization', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '{}', '2026-01-06 17:59:24.771');
INSERT INTO public.audit_logs VALUES ('a4f33c89-7ae4-4631-b108-eed54842510f', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'qualification_run', 'qualification', '276bd7a9-8928-49ab-9382-c9a7c0e9c967', '{"score": 20, "leadId": "563674fa-228e-4680-9597-a4f72fed1936", "confidence": 20, "disposition": "decline", "factorCount": 1}', '2026-01-06 18:02:47.013');
INSERT INTO public.audit_logs VALUES ('11e575cd-191d-4ae6-908c-59dc5798b3c9', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'policy_test.run', 'policy_test_suite', 'default-policy-suite-e552396a-e129-4a16-aa24-a016f9dcaba3', '{"runId": "641d8ac6-971a-48c3-a0e3-5e460b165345", "status": "failed", "failedCount": 1, "passedCount": 5}', '2026-01-06 18:03:29.316');
INSERT INTO public.audit_logs VALUES ('a56f7659-dfcb-4c46-bc8b-314d092cb035', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T18:14:44.752Z"}', '2026-01-06 18:14:44.76');
INSERT INTO public.audit_logs VALUES ('1cb90f00-855f-41f3-80ea-fff09c285611', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T18:43:55.434Z"}', '2026-01-06 18:43:55.44');
INSERT INTO public.audit_logs VALUES ('46bd295c-c0df-46c5-b7fb-4d5ac2ca023e', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T21:18:36.809Z"}', '2026-01-06 21:18:36.819');
INSERT INTO public.audit_logs VALUES ('0ade4b65-3a90-425e-ac9d-902f77c06724', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'policy_test.run', 'policy_test_suite', 'default-policy-suite-e552396a-e129-4a16-aa24-a016f9dcaba3', '{"runId": "bb01d119-e4ab-46c0-b0af-111b1d842e4a", "status": "failed", "failedCount": 1, "passedCount": 5}', '2026-01-06 21:21:12.458');
INSERT INTO public.audit_logs VALUES ('23009282-3ac0-432e-87ee-f19e8e484490', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'user', 'policy_test.run', 'policy_test_suite', '8093199e-019e-4c74-ab0f-52edaa170e36', '{"runId": "364d5a99-bf14-4d69-8f9b-fdde8384a101", "status": "failed", "failedCount": 1, "passedCount": 5}', '2026-01-06 21:21:46.663');
INSERT INTO public.audit_logs VALUES ('60b63b2a-e2b8-4639-affd-0e959a52cf47', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T21:36:53.477Z"}', '2026-01-06 21:36:53.484');
INSERT INTO public.audit_logs VALUES ('088b36fb-05d2-4735-8b4e-74b797b36c20', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T21:38:47.654Z"}', '2026-01-06 21:38:47.66');
INSERT INTO public.audit_logs VALUES ('51002950-9be6-42fa-b2d7-eafa660b2e20', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-06T21:39:24.445Z"}', '2026-01-06 21:39:24.451');
INSERT INTO public.audit_logs VALUES ('98c13bfe-aab8-450e-be28-fddd78133421', 'test-org-openai-sim-001', NULL, 'system', 'inbound_call_received', 'call', '5c878b48-9688-47f2-9474-fd44a1bc0b49', '{"to": "+15559876543", "from": "+15551234567", "twilioCallSid": "CAcall_test_1767773304301_a432d46d", "providerCallId": "call_test_1767773304301_a432d46d"}', '2026-01-07 08:08:24.417');
INSERT INTO public.audit_logs VALUES ('9c1afe64-2a0f-4270-b104-5500c0b93502', 'test-org-openai-sim-001', NULL, 'system', 'inbound_call_received', 'call', '2b798d15-4f46-4603-8f50-50424d469b5b', '{"to": "+15559876543", "from": "+15551234567", "twilioCallSid": "CA_IDEMPOTENCY_TEST_001"}', '2026-01-07 08:17:16.126');
INSERT INTO public.audit_logs VALUES ('ce8ec913-5929-4dc9-9c6d-153db0dfd3d2', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '13177319-776d-48b0-9888-bf8a39cc96ed', 'system', 'login', 'user', '13177319-776d-48b0-9888-bf8a39cc96ed', '{"email": "owner@demo.com", "timestamp": "2026-01-07T09:16:50.792Z"}', '2026-01-07 09:16:50.798');
INSERT INTO public.audit_logs VALUES ('485449e3-2e04-4db2-9aa9-e7e7383d1fa8', 'test-org-openai-sim-001', NULL, 'system', 'inbound_call_received', 'call', '5b6276a1-dfce-4fff-8cde-7e48ed3793c9', '{"to": "+15559876543", "from": "+15551234567", "twilioCallSid": "CA_LOG_MASK_TEST_002"}', '2026-01-07 09:19:11.83');
INSERT INTO public.audit_logs VALUES ('394a9375-6b54-4855-b520-cf9e21ace5a4', 'test-org-openai-sim-001', NULL, 'system', 'inbound_call_received', 'call', 'c43d2cfd-2172-4a68-ad48-2eecd741f024', '{"to": "+15559876543", "from": "+15551234567", "twilioCallSid": "CA_LOG_MASK_TEST_003"}', '2026-01-07 09:19:25.235');
INSERT INTO public.audit_logs VALUES ('0db99cb2-7d67-45c4-a3d3-46629338b6f9', 'test-org-openai-sim-001', NULL, 'system', 'inbound_call_received', 'call', '775d3c3a-584e-4dd3-9562-87b691a86a65', '{"to": "+15559876543", "from": "+15551234567", "twilioCallSid": "CA_LOG_MASK_TEST_004"}', '2026-01-07 09:20:18.875');


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.contacts VALUES ('e680d2d1-bc52-4586-948f-2329451bf9e0', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'John Smith', '+15551234567', 'john@example.com', '2026-01-06 08:10:00.765', '2026-01-06 08:10:00.765');
INSERT INTO public.contacts VALUES ('d34e29c6-2240-41b1-af5f-4d9d9fe4a704', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'Jane Doe', '+15559876543', NULL, '2026-01-06 08:10:28.78', '2026-01-06 08:10:28.78');
INSERT INTO public.contacts VALUES ('a8d4b6fd-99e7-4590-855a-60342a675e2f', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', 'John Smoke', '+15551234567', 'john.smoke@test.com', '2026-01-06 12:00:55.102', '2026-01-06 12:00:55.102');
INSERT INTO public.contacts VALUES ('f5492642-563e-4107-99ae-aefc576dca2a', 'b5612572-44f4-4cf8-9669-bfb948879453', 'John Smoke', '+15551234567', 'john.smoke@test.com', '2026-01-06 12:02:56.726', '2026-01-06 12:02:56.726');
INSERT INTO public.contacts VALUES ('c8c7a832-1091-4822-833b-7fc0da1b040b', 'f28745ea-373c-450a-98b5-871a14aa85d1', 'John Smoke', '+15551234567', 'john.smoke@test.com', '2026-01-06 12:26:54.205', '2026-01-06 12:26:54.205');
INSERT INTO public.contacts VALUES ('11e5ff49-e4ce-435b-836b-d871a23842ed', 'test-org-openai-sim-001', 'Unknown Caller', '+15551234567', NULL, '2026-01-07 08:08:24.383', '2026-01-07 08:08:24.383');


--
-- Data for Name: practice_areas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.practice_areas VALUES ('personal-injury-e552396a-e129-4a16-aa24-a016f9dcaba3', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'Personal Injury', true, '2026-01-06 07:51:32.093', '2026-01-06 17:58:14.787');
INSERT INTO public.practice_areas VALUES ('criminal-defense-e552396a-e129-4a16-aa24-a016f9dcaba3', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'Criminal Defense', true, '2026-01-06 07:51:32.096', '2026-01-06 17:58:14.954');


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.leads VALUES ('563674fa-228e-4680-9597-a4f72fed1936', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'e680d2d1-bc52-4586-948f-2329451bf9e0', 'phone', 'contacted', 'high', NULL, NULL, NULL, 'Client confirmed accident details', '2026-01-06 08:10:00.88', '2026-01-06 08:10:13.377');
INSERT INTO public.leads VALUES ('5d2d4389-dc34-4576-92eb-7a7d64f1724e', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'd34e29c6-2240-41b1-af5f-4d9d9fe4a704', 'web', 'new', 'medium', NULL, NULL, NULL, 'Slip and fall at store', '2026-01-06 08:10:28.791', '2026-01-06 08:10:28.791');
INSERT INTO public.leads VALUES ('e16b0f2e-4f81-44bc-9da2-b723ebf4b18e', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', 'a8d4b6fd-99e7-4590-855a-60342a675e2f', 'smoke_test', 'new', 'medium', NULL, NULL, NULL, 'Smoke test lead for API verification', '2026-01-06 12:00:55.147', '2026-01-06 12:00:55.147');
INSERT INTO public.leads VALUES ('e34ad302-d978-45c5-b216-fc3ff2f7abe5', 'b5612572-44f4-4cf8-9669-bfb948879453', 'f5492642-563e-4107-99ae-aefc576dca2a', 'smoke_test', 'new', 'medium', NULL, NULL, NULL, 'Smoke test lead for API verification', '2026-01-06 12:02:56.756', '2026-01-06 12:02:56.756');
INSERT INTO public.leads VALUES ('6741b526-a91d-4035-a38e-14c7492651fd', 'f28745ea-373c-450a-98b5-871a14aa85d1', 'c8c7a832-1091-4822-833b-7fc0da1b040b', 'smoke_test', 'new', 'medium', NULL, NULL, NULL, 'Smoke test lead for API verification', '2026-01-06 12:26:54.237', '2026-01-06 12:26:54.237');
INSERT INTO public.leads VALUES ('a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', 'test-org-openai-sim-001', '11e5ff49-e4ce-435b-836b-d871a23842ed', 'phone', 'new', 'medium', NULL, NULL, NULL, NULL, '2026-01-07 08:08:24.397', '2026-01-07 08:08:24.397');


--
-- Data for Name: interactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.interactions VALUES ('c3a6d8af-ba68-4e39-a159-4925f9c9dba6', 'test-org-openai-sim-001', 'a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', 'call', 'active', '2026-01-07 08:08:24.401', NULL, NULL, '2026-01-07 08:08:24.401', '2026-01-07 08:08:24.401');
INSERT INTO public.interactions VALUES ('511aac96-0e6b-4ab4-a627-cf059df45e35', 'test-org-openai-sim-001', 'a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', 'call', 'active', '2026-01-07 08:17:16.111', NULL, '{"To": "+15559876543", "From": "+15551234567", "CallSid": "CA_IDEMPOTENCY_TEST_001", "Direction": "inbound", "CallStatus": "ringing", "CallerName": "Test Caller"}', '2026-01-07 08:17:16.111', '2026-01-07 08:17:16.111');
INSERT INTO public.interactions VALUES ('1fdbe36f-47dc-479c-8269-b7196c8025f9', 'test-org-openai-sim-001', 'a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', 'call', 'active', '2026-01-07 09:19:11.796', NULL, '{"To": "+15559876543", "From": "+15551234567", "CallSid": "CA_LOG_MASK_TEST_002", "Direction": "inbound", "CallStatus": "ringing"}', '2026-01-07 09:19:11.796', '2026-01-07 09:19:11.796');
INSERT INTO public.interactions VALUES ('a420a3f5-522b-4699-99bb-910f7ff9beb2', 'test-org-openai-sim-001', 'a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', 'call', 'active', '2026-01-07 09:19:25.217', NULL, '{"To": "+15559876543", "From": "+15551234567", "CallSid": "CA_LOG_MASK_TEST_003", "Direction": "inbound", "CallStatus": "ringing"}', '2026-01-07 09:19:25.217', '2026-01-07 09:19:25.217');
INSERT INTO public.interactions VALUES ('9c28d261-5f0e-4cc5-a5e1-4f586dfa7f6f', 'test-org-openai-sim-001', 'a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', 'call', 'active', '2026-01-07 09:20:18.857', NULL, '{"To": "+15559876543", "From": "+15551234567", "CallSid": "CA_LOG_MASK_TEST_004", "Direction": "inbound", "CallStatus": "ringing"}', '2026-01-07 09:20:18.857', '2026-01-07 09:20:18.857');


--
-- Data for Name: phone_numbers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.phone_numbers VALUES ('test-phone-openai-sim-001', 'test-org-openai-sim-001', 'OpenAI Simulator Test Line', '+15559876543', 'twilio', NULL, true, false, NULL, '2026-01-07 08:08:18.06', '2026-01-07 08:08:18.06');
INSERT INTO public.phone_numbers VALUES ('f3577d56-d807-417c-9381-9afbca3c0961', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'Twilio Main Line', '+18443214257', 'twilio', NULL, true, false, NULL, '2026-01-07 09:35:36.987', '2026-01-07 09:35:36.987');


--
-- Data for Name: calls; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.calls VALUES ('5c878b48-9688-47f2-9474-fd44a1bc0b49', 'test-org-openai-sim-001', 'a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', 'c3a6d8af-ba68-4e39-a159-4925f9c9dba6', 'test-phone-openai-sim-001', 'inbound', 'openai_realtime', 'call_test_1767773304301_a432d46d', '+15551234567', '+15559876543', '2026-01-07 08:08:24.405', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-07 08:08:24.407', '2026-01-07 08:08:24.407', 'CAcall_test_1767773304301_a432d46d');
INSERT INTO public.calls VALUES ('2b798d15-4f46-4603-8f50-50424d469b5b', 'test-org-openai-sim-001', 'a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', '511aac96-0e6b-4ab4-a627-cf059df45e35', 'test-phone-openai-sim-001', 'inbound', 'twilio', NULL, '+15551234567', '+15559876543', '2026-01-07 08:17:16.116', NULL, NULL, NULL, NULL, '{"rawPayload": {"To": "+15559876543", "From": "+15551234567", "CallSid": "CA_IDEMPOTENCY_TEST_001", "Direction": "inbound", "CallStatus": "ringing", "CallerName": "Test Caller"}}', NULL, NULL, '2026-01-07 08:17:16.119', '2026-01-07 08:17:16.119', 'CA_IDEMPOTENCY_TEST_001');
INSERT INTO public.calls VALUES ('5b6276a1-dfce-4fff-8cde-7e48ed3793c9', 'test-org-openai-sim-001', 'a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', '1fdbe36f-47dc-479c-8269-b7196c8025f9', 'test-phone-openai-sim-001', 'inbound', 'twilio', NULL, '+15551234567', '+15559876543', '2026-01-07 09:19:11.814', NULL, NULL, NULL, NULL, '{"rawPayload": {"To": "+15559876543", "From": "+15551234567", "CallSid": "CA_LOG_MASK_TEST_002", "Direction": "inbound", "CallStatus": "ringing"}}', NULL, NULL, '2026-01-07 09:19:11.819', '2026-01-07 09:19:11.819', 'CA_LOG_MASK_TEST_002');
INSERT INTO public.calls VALUES ('c43d2cfd-2172-4a68-ad48-2eecd741f024', 'test-org-openai-sim-001', 'a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', 'a420a3f5-522b-4699-99bb-910f7ff9beb2', 'test-phone-openai-sim-001', 'inbound', 'twilio', NULL, '+15551234567', '+15559876543', '2026-01-07 09:19:25.224', NULL, NULL, NULL, NULL, '{"rawPayload": {"To": "+15559876543", "From": "+15551234567", "CallSid": "CA_LOG_MASK_TEST_003", "Direction": "inbound", "CallStatus": "ringing"}}', NULL, NULL, '2026-01-07 09:19:25.228', '2026-01-07 09:19:25.228', 'CA_LOG_MASK_TEST_003');
INSERT INTO public.calls VALUES ('775d3c3a-584e-4dd3-9562-87b691a86a65', 'test-org-openai-sim-001', 'a5ccddae-aa5e-413d-b8f6-a4b9f07377d1', '9c28d261-5f0e-4cc5-a5e1-4f586dfa7f6f', 'test-phone-openai-sim-001', 'inbound', 'twilio', NULL, '+15551234567', '+15559876543', '2026-01-07 09:20:18.867', NULL, NULL, NULL, NULL, '{"rawPayload": {"To": "+15559876543", "From": "+15551234567", "CallSid": "CA_LOG_MASK_TEST_004", "Direction": "inbound", "CallStatus": "ringing"}}', NULL, NULL, '2026-01-07 09:20:18.87', '2026-01-07 09:20:18.87', 'CA_LOG_MASK_TEST_004');


--
-- Data for Name: experiments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.experiments VALUES ('7d87453a-6355-4387-938f-f5bc8186cf58', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', 'Smoke Test Experiment', NULL, 'intake_script', 'running', '{"variants": ["control", "variant_a"]}', '2026-01-06 12:00:55.387', NULL, NULL, '2026-01-06 12:00:55.373', '2026-01-06 12:00:55.389');
INSERT INTO public.experiments VALUES ('27b9b3c4-6173-405c-bf5d-ce226b3e97ac', 'b5612572-44f4-4cf8-9669-bfb948879453', 'Smoke Test Experiment', NULL, 'intake_script', 'running', '{"variants": ["control", "variant_a"]}', '2026-01-06 12:02:56.94', NULL, NULL, '2026-01-06 12:02:56.928', '2026-01-06 12:02:56.941');
INSERT INTO public.experiments VALUES ('e8d9d959-d386-4a63-a96d-70abbf7a2756', 'f28745ea-373c-450a-98b5-871a14aa85d1', 'Smoke Test Experiment', NULL, 'intake_script', 'running', '{"variants": ["control", "variant_a"]}', '2026-01-06 12:26:54.45', NULL, NULL, '2026-01-06 12:26:54.44', '2026-01-06 12:26:54.451');


--
-- Data for Name: experiment_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.experiment_assignments VALUES ('4f4ea358-65cf-499b-ac6d-01abc0ffb3d3', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '7d87453a-6355-4387-938f-f5bc8186cf58', 'e16b0f2e-4f81-44bc-9da2-b723ebf4b18e', 'control', '2026-01-06 12:00:55.41');
INSERT INTO public.experiment_assignments VALUES ('be5c1eb3-bdd2-4caf-af96-839ff7ac5eb0', 'b5612572-44f4-4cf8-9669-bfb948879453', '27b9b3c4-6173-405c-bf5d-ce226b3e97ac', 'e34ad302-d978-45c5-b216-fc3ff2f7abe5', 'control', '2026-01-06 12:02:56.958');
INSERT INTO public.experiment_assignments VALUES ('fa115c35-4ed3-4e48-b493-94a14776e8ff', 'f28745ea-373c-450a-98b5-871a14aa85d1', 'e8d9d959-d386-4a63-a96d-70abbf7a2756', '6741b526-a91d-4035-a38e-14c7492651fd', 'variant_a', '2026-01-06 12:26:54.466');


--
-- Data for Name: experiment_metrics_daily; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: followup_sequences; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.followup_sequences VALUES ('default-followup-e552396a-e129-4a16-aa24-a016f9dcaba3', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'New Lead Welcome Sequence', 'Automated follow-up for new leads', 'lead_created', '[{"channel": "sms", "delayMinutes": 0, "templateBody": "Thank you for contacting Demo Law Firm. We have received your inquiry and will be in touch shortly."}, {"channel": "sms", "delayMinutes": 60, "templateBody": "Hi! Just following up on your inquiry. Is there any additional information you can share about your situation?"}, {"channel": "sms", "delayMinutes": 1440, "templateBody": "We wanted to make sure you received our messages. Our team is ready to help. Reply or call us at your convenience."}]', '{"onResponse": true, "onStatusChange": ["disqualified", "closed"]}', true, '2026-01-06 11:52:34.944', '2026-01-06 11:52:34.944');


--
-- Data for Name: followup_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: intake_question_sets; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.intake_question_sets VALUES ('default-intake-e552396a-e129-4a16-aa24-a016f9dcaba3', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'personal-injury-e552396a-e129-4a16-aa24-a016f9dcaba3', 'Standard Personal Injury Intake', 1, '{"version": "1.0", "sections": [{"id": "contact_info", "title": "Contact Information", "questions": [{"id": "full_name", "type": "text", "label": "Full Legal Name", "required": true}, {"id": "phone", "type": "phone", "label": "Best Phone Number", "required": true}, {"id": "email", "type": "email", "label": "Email Address", "required": false}]}, {"id": "incident_details", "title": "Incident Details", "questions": [{"id": "incident_date", "type": "date", "label": "When did the incident occur?", "required": true}, {"id": "incident_location", "type": "text", "label": "Where did the incident occur?", "required": true}, {"id": "incident_description", "type": "textarea", "label": "Please describe what happened", "required": true}, {"id": "injuries", "type": "textarea", "label": "What injuries did you sustain?", "required": true}, {"id": "medical_treatment", "type": "radio", "label": "Have you sought medical treatment?", "options": ["Yes", "No", "Planned"], "required": true}]}, {"id": "parties", "title": "Other Parties", "questions": [{"id": "other_party_name", "type": "text", "label": "Name of other party involved (if known)", "required": false}, {"id": "other_party_insurance", "type": "text", "label": "Other party''s insurance company (if known)", "required": false}, {"id": "police_report", "type": "radio", "label": "Was a police report filed?", "options": ["Yes", "No", "Unknown"], "required": true}]}]}', true, '2026-01-06 07:51:32.126', '2026-01-06 07:51:32.126');


--
-- Data for Name: intakes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.intakes VALUES ('55aad2ad-78e5-49a3-9fba-ec2b02cf2b32', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', 'e16b0f2e-4f81-44bc-9da2-b723ebf4b18e', NULL, NULL, '{"injuries": "Back pain, whiplash", "incidentDate": "2024-06-15", "incidentLocation": "Highway 101"}', 'complete', '2026-01-06 12:00:55.224', '2026-01-06 12:00:55.179', '2026-01-06 12:00:55.227');
INSERT INTO public.intakes VALUES ('318c76e7-6807-4823-8e08-997b19e2148f', 'b5612572-44f4-4cf8-9669-bfb948879453', 'e34ad302-d978-45c5-b216-fc3ff2f7abe5', NULL, NULL, '{"injuries": "Back pain, whiplash", "incidentDate": "2024-06-15", "incidentLocation": "Highway 101"}', 'complete', '2026-01-06 12:02:56.845', '2026-01-06 12:02:56.792', '2026-01-06 12:02:56.846');
INSERT INTO public.intakes VALUES ('0c24d67b-e85b-44fa-89c0-62bbde625be4', 'f28745ea-373c-450a-98b5-871a14aa85d1', '6741b526-a91d-4035-a38e-14c7492651fd', NULL, NULL, '{"injuries": "Back pain, whiplash", "incidentDate": "2024-06-15", "incidentLocation": "Highway 101"}', 'complete', '2026-01-06 12:26:54.365', '2026-01-06 12:26:54.279', '2026-01-06 12:26:54.368');


--
-- Data for Name: marketing_contact_submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.marketing_contact_submissions VALUES ('20c408ee-f5ec-4e30-93d5-1169b83f784f', NULL, 'Test User', 'test@example.com', NULL, 'This is a test message from the contact form.', '{"ip": "127.0.0.1", "userAgent": "curl/8.14.1", "submittedAt": "2026-01-06T08:49:26.859Z"}', '2026-01-06 08:49:26.965');
INSERT INTO public.marketing_contact_submissions VALUES ('2dde4e0a-10cd-41bd-beb8-03e4a7b88347', NULL, 'Test User', 'test@example.com', NULL, 'This is a test message from the contact form.', '{"ip": "127.0.0.1", "userAgent": "curl/8.14.1", "submittedAt": "2026-01-06T08:52:19.842Z"}', '2026-01-06 08:52:19.919');


--
-- Data for Name: marketing_submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.marketing_submissions VALUES ('6bc4ab19-0cd1-4773-b781-c0be5392d523', 'demo', 'Mik', 'mike@mikesimmons.co', 'Yehs', '5049005237', NULL, NULL, NULL, NULL, '{"ip": "172.31.81.34", "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1", "submittedAt": "2026-01-06T09:46:20.602Z"}', '2026-01-06 09:46:20.71');
INSERT INTO public.marketing_submissions VALUES ('f53e7ab6-854a-4ee9-8579-41302bd4fc75', 'demo', 'Mkwl', 'ekrnr@tkfn.clm', 'Djej', '618461956149', 'criminal_defense', 'none', 'under_50', NULL, '{"ip": "172.31.81.34", "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Replit-Bonsai/2.169.1 (iOS 26.3)", "submittedAt": "2026-01-06T09:47:01.882Z"}', '2026-01-06 09:47:01.883');


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: org_health_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: outgoing_webhook_endpoints; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.outgoing_webhook_endpoints VALUES ('e969577f-3d0c-4649-97d0-254cfbfa20bd', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', 'https://httpbin.org/post', '6a8271cbad2857f816dbf5b50c921155eb58b504732e34679c91a2700b63555c', '{lead.created,intake.completed}', true, '2026-01-06 12:00:55.343', '2026-01-06 12:00:55.343');
INSERT INTO public.outgoing_webhook_endpoints VALUES ('9be1edd7-8ab6-4cf7-a3f1-eb5242f26688', 'b5612572-44f4-4cf8-9669-bfb948879453', 'https://httpbin.org/post', 'fa308e2289009498bdd4f71803cde88db447ecad986ed6468587a1439c965098', '{lead.created,intake.completed}', true, '2026-01-06 12:02:56.905', '2026-01-06 12:02:56.905');
INSERT INTO public.outgoing_webhook_endpoints VALUES ('67ab5ddb-35c3-4de4-85ed-61b889b7d8b0', 'f28745ea-373c-450a-98b5-871a14aa85d1', 'https://httpbin.org/post', 'fba3e05af992d595e41fca758268f9e4b11d2179c69286b11fd1623a52e6e99e', '{lead.created,intake.completed}', true, '2026-01-06 12:26:54.422', '2026-01-06 12:26:54.422');


--
-- Data for Name: outgoing_webhook_deliveries; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: policy_test_suites; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.policy_test_suites VALUES ('default-policy-suite-e552396a-e129-4a16-aa24-a016f9dcaba3', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'Qualification Regression Tests', 'Default suite to validate qualification scoring logic', '[{"id": "tc1", "name": "Complete lead with phone+email accepts", "input": {"calls": 2, "intake": {"answers": {"incidentDate": "2024-01-15", "incidentLocation": "Highway 101"}, "complete": true}, "contact": {"email": "test@example.com", "phone": "+15551234567"}, "practiceArea": true}, "expectedMinScore": 70, "expectedDisposition": "accept"}, {"id": "tc2", "name": "Minimal info leads to review", "input": {"calls": 0, "intake": {"complete": false}, "contact": {"phone": "+15551234567"}, "practiceArea": false}, "expectedDisposition": "review"}, {"id": "tc3", "name": "No contact info declines", "input": {"calls": 0, "intake": {"complete": false}, "contact": {}, "practiceArea": false}, "expectedDisposition": "decline"}, {"id": "tc4", "name": "Partial intake with practice area reviews", "input": {"calls": 1, "intake": {"answers": {"incidentDate": "2024-01-15"}, "complete": false}, "contact": {"email": "partial@test.com"}, "practiceArea": true}, "expectedDisposition": "review"}, {"id": "tc5", "name": "Complete intake without calls accepts", "input": {"calls": 0, "intake": {"answers": {"incidentDate": "2024-02-01", "incidentLocation": "Main Street"}, "complete": true}, "contact": {"email": "complete@test.com", "phone": "+15559876543"}, "practiceArea": true}, "expectedDisposition": "accept"}, {"id": "tc6", "name": "High engagement with partial info reviews", "input": {"calls": 3, "intake": {"answers": {}, "complete": false}, "contact": {"phone": "+15551112222"}, "practiceArea": true}, "expectedDisposition": "review"}]', true, '2026-01-06 11:52:34.921', '2026-01-06 11:52:34.921');
INSERT INTO public.policy_test_suites VALUES ('879585ea-3b34-4cf9-9e46-043643e35603', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', 'Smoke Test Suite', NULL, '[{"id": "tc1", "name": "Test case 1", "input": {"calls": 1, "intake": {"answers": {}, "complete": true}, "contact": {"phone": "+15551234567"}, "practiceArea": true}, "expectedDisposition": "accept"}, {"id": "tc2", "name": "Test case 2", "input": {"calls": 0, "intake": {"complete": false}, "contact": {}, "practiceArea": false}, "expectedDisposition": "decline"}]', true, '2026-01-06 12:00:55.432', '2026-01-06 12:00:55.432');
INSERT INTO public.policy_test_suites VALUES ('7b085574-d94b-4428-b92c-1f369b830d6f', 'b5612572-44f4-4cf8-9669-bfb948879453', 'Smoke Test Suite', NULL, '[{"id": "tc1", "name": "Test case 1", "input": {"calls": 1, "intake": {"answers": {}, "complete": true}, "contact": {"phone": "+15551234567"}, "practiceArea": true}, "expectedDisposition": "accept"}, {"id": "tc2", "name": "Test case 2", "input": {"calls": 0, "intake": {"complete": false}, "contact": {}, "practiceArea": false}, "expectedDisposition": "decline"}]', true, '2026-01-06 12:02:56.976', '2026-01-06 12:02:56.976');
INSERT INTO public.policy_test_suites VALUES ('d6de63b3-3010-44bb-9123-94513fc8ce2c', 'f28745ea-373c-450a-98b5-871a14aa85d1', 'Smoke Test Suite', NULL, '[{"id": "tc1", "name": "Test case 1", "input": {"calls": 1, "intake": {"answers": {}, "complete": true}, "contact": {"phone": "+15551234567"}, "practiceArea": true}, "expectedDisposition": "accept"}, {"id": "tc2", "name": "Test case 2", "input": {"calls": 0, "intake": {"complete": false}, "contact": {}, "practiceArea": false}, "expectedDisposition": "decline"}]', true, '2026-01-06 12:26:54.486', '2026-01-06 12:26:54.486');
INSERT INTO public.policy_test_suites VALUES ('8093199e-019e-4c74-ab0f-52edaa170e36', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'Qual test ', 'Validate logic ', '[{"id": "tc1", "name": "Complete lead with phone+email accepts", "input": {"calls": 2, "intake": {"answers": {"incidentDate": "2024-01-15", "incidentLocation": "Highway 101"}, "complete": true}, "contact": {"email": "test@example.com", "phone": "+15551234567"}, "practiceArea": true}, "expectedMinScore": 70, "expectedDisposition": "accept"}, {"id": "tc2", "name": "Minimal info leads to review", "input": {"calls": 0, "intake": {"complete": false}, "contact": {"phone": "+15551234567"}, "practiceArea": false}, "expectedDisposition": "review"}, {"id": "tc3", "name": "No contact info declines", "input": {"calls": 0, "intake": {"complete": false}, "contact": {}, "practiceArea": false}, "expectedDisposition": "decline"}, {"id": "tc4", "name": "Partial intake with practice area reviews", "input": {"calls": 1, "intake": {"answers": {"incidentDate": "2024-01-15"}, "complete": false}, "contact": {"email": "partial@test.com"}, "practiceArea": true}, "expectedDisposition": "review"}, {"id": "tc5", "name": "Complete intake without calls accepts", "input": {"calls": 0, "intake": {"answers": {"incidentDate": "2024-02-01", "incidentLocation": "Main Street"}, "complete": true}, "contact": {"email": "complete@test.com", "phone": "+15559876543"}, "practiceArea": true}, "expectedDisposition": "accept"}, {"id": "tc6", "name": "High engagement with partial info reviews", "input": {"calls": 3, "intake": {"answers": {}, "complete": false}, "contact": {"phone": "+15551112222"}, "practiceArea": true}, "expectedDisposition": "review"}]', true, '2026-01-06 21:21:44.291', '2026-01-06 21:21:44.291');


--
-- Data for Name: policy_test_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.policy_test_runs VALUES ('f5570be2-519a-4cdb-af1a-19fa796cb160', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', '879585ea-3b34-4cf9-9e46-043643e35603', 'failed', '[{"name": "Test case 1", "passed": false, "testId": "tc1", "actualScore": 60, "actualDisposition": "review"}, {"name": "Test case 2", "passed": true, "testId": "tc2", "actualScore": 0, "actualDisposition": "decline"}]', '{"totalCount": 2, "failedCount": 1, "passedCount": 1}', '2026-01-06 12:00:55.46', '2026-01-06 12:00:55.459');
INSERT INTO public.policy_test_runs VALUES ('e95caeba-1137-4c40-a476-c2eb691c61ae', 'b5612572-44f4-4cf8-9669-bfb948879453', '7b085574-d94b-4428-b92c-1f369b830d6f', 'failed', '[{"name": "Test case 1", "passed": false, "testId": "tc1", "actualScore": 60, "actualDisposition": "review"}, {"name": "Test case 2", "passed": true, "testId": "tc2", "actualScore": 0, "actualDisposition": "decline"}]', '{"totalCount": 2, "failedCount": 1, "passedCount": 1}', '2026-01-06 12:02:57.005', '2026-01-06 12:02:57.004');
INSERT INTO public.policy_test_runs VALUES ('f30d0fc0-be65-4809-93bb-2732e38d2f24', 'f28745ea-373c-450a-98b5-871a14aa85d1', 'd6de63b3-3010-44bb-9123-94513fc8ce2c', 'failed', '[{"name": "Test case 1", "passed": false, "testId": "tc1", "actualScore": 60, "actualDisposition": "review"}, {"name": "Test case 2", "passed": true, "testId": "tc2", "actualScore": 0, "actualDisposition": "decline"}]', '{"totalCount": 2, "failedCount": 1, "passedCount": 1}', '2026-01-06 12:26:54.521', '2026-01-06 12:26:54.52');
INSERT INTO public.policy_test_runs VALUES ('641d8ac6-971a-48c3-a0e3-5e460b165345', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'default-policy-suite-e552396a-e129-4a16-aa24-a016f9dcaba3', 'failed', '[{"name": "Complete lead with phone+email accepts", "passed": true, "testId": "tc1", "actualScore": 100, "actualDisposition": "accept"}, {"name": "Minimal info leads to review", "passed": false, "testId": "tc2", "actualScore": 10, "actualDisposition": "decline"}, {"name": "No contact info declines", "passed": true, "testId": "tc3", "actualScore": 0, "actualDisposition": "decline"}, {"name": "Partial intake with practice area reviews", "passed": true, "testId": "tc4", "actualScore": 55, "actualDisposition": "review"}, {"name": "Complete intake without calls accepts", "passed": true, "testId": "tc5", "actualScore": 80, "actualDisposition": "accept"}, {"name": "High engagement with partial info reviews", "passed": true, "testId": "tc6", "actualScore": 45, "actualDisposition": "review"}]', '{"totalCount": 6, "failedCount": 1, "passedCount": 5}', '2026-01-06 18:03:29.228', '2026-01-06 18:03:29.227');
INSERT INTO public.policy_test_runs VALUES ('bb01d119-e4ab-46c0-b0af-111b1d842e4a', 'e552396a-e129-4a16-aa24-a016f9dcaba3', 'default-policy-suite-e552396a-e129-4a16-aa24-a016f9dcaba3', 'failed', '[{"name": "Complete lead with phone+email accepts", "passed": true, "testId": "tc1", "actualScore": 100, "actualDisposition": "accept"}, {"name": "Minimal info leads to review", "passed": false, "testId": "tc2", "actualScore": 10, "actualDisposition": "decline"}, {"name": "No contact info declines", "passed": true, "testId": "tc3", "actualScore": 0, "actualDisposition": "decline"}, {"name": "Partial intake with practice area reviews", "passed": true, "testId": "tc4", "actualScore": 55, "actualDisposition": "review"}, {"name": "Complete intake without calls accepts", "passed": true, "testId": "tc5", "actualScore": 80, "actualDisposition": "accept"}, {"name": "High engagement with partial info reviews", "passed": true, "testId": "tc6", "actualScore": 45, "actualDisposition": "review"}]', '{"totalCount": 6, "failedCount": 1, "passedCount": 5}', '2026-01-06 21:21:12.439', '2026-01-06 21:21:12.436');
INSERT INTO public.policy_test_runs VALUES ('364d5a99-bf14-4d69-8f9b-fdde8384a101', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '8093199e-019e-4c74-ab0f-52edaa170e36', 'failed', '[{"name": "Complete lead with phone+email accepts", "passed": true, "testId": "tc1", "actualScore": 100, "actualDisposition": "accept"}, {"name": "Minimal info leads to review", "passed": false, "testId": "tc2", "actualScore": 10, "actualDisposition": "decline"}, {"name": "No contact info declines", "passed": true, "testId": "tc3", "actualScore": 0, "actualDisposition": "decline"}, {"name": "Partial intake with practice area reviews", "passed": true, "testId": "tc4", "actualScore": 55, "actualDisposition": "review"}, {"name": "Complete intake without calls accepts", "passed": true, "testId": "tc5", "actualScore": 80, "actualDisposition": "accept"}, {"name": "High engagement with partial info reviews", "passed": true, "testId": "tc6", "actualScore": 45, "actualDisposition": "review"}]', '{"totalCount": 6, "failedCount": 1, "passedCount": 5}', '2026-01-06 21:21:46.659', '2026-01-06 21:21:46.657');


--
-- Data for Name: qualifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.qualifications VALUES ('615fc640-96b6-4a55-9630-cd55ccbc461f', '01cd30e7-388c-4b83-b9c7-fd29f0921b91', 'e16b0f2e-4f81-44bc-9da2-b723ebf4b18e', 45, 'review', '{"model": {"model": "qualification-v1", "version": "1.0.0", "provider": "stub"}, "routing": {"notes": "Needs additional screening", "practice_area_id": null}, "explanations": ["Lead scored 45/100 based on 2 evaluation factors.", "Missing information: practice_area, incident_date, incident_location."], "disqualifiers": [], "score_factors": [{"name": "Contact Information", "weight": 20, "evidence": "Both phone and email provided", "evidence_quote": null}, {"name": "Intake Completed", "weight": 25, "evidence": "Intake form completed with 3 answers", "evidence_quote": null}], "missing_fields": ["practice_area", "incident_date", "incident_location"]}', 40, '2026-01-06 12:00:55.298', '2026-01-06 12:00:55.298');
INSERT INTO public.qualifications VALUES ('1c75c084-fcec-42fb-9c2b-a396a0d0f1d1', 'b5612572-44f4-4cf8-9669-bfb948879453', 'e34ad302-d978-45c5-b216-fc3ff2f7abe5', 45, 'review', '{"model": {"model": "qualification-v1", "version": "1.0.0", "provider": "stub"}, "routing": {"notes": "Needs additional screening", "practice_area_id": null}, "explanations": ["Lead scored 45/100 based on 2 evaluation factors.", "Missing information: practice_area, incident_date, incident_location."], "disqualifiers": [], "score_factors": [{"name": "Contact Information", "weight": 20, "evidence": "Both phone and email provided", "evidence_quote": null}, {"name": "Intake Completed", "weight": 25, "evidence": "Intake form completed with 3 answers", "evidence_quote": null}], "missing_fields": ["practice_area", "incident_date", "incident_location"]}', 40, '2026-01-06 12:02:56.888', '2026-01-06 12:02:56.888');
INSERT INTO public.qualifications VALUES ('736cf681-6480-465f-81d4-b2216cae93ec', 'f28745ea-373c-450a-98b5-871a14aa85d1', '6741b526-a91d-4035-a38e-14c7492651fd', 45, 'review', '{"model": {"model": "qualification-v1", "version": "1.0.0", "provider": "stub"}, "routing": {"notes": "Needs additional screening", "practice_area_id": null}, "explanations": ["Lead scored 45/100 based on 2 evaluation factors.", "Missing information: practice_area, incident_date, incident_location."], "disqualifiers": [], "score_factors": [{"name": "Contact Information", "weight": 20, "evidence": "Both phone and email provided", "evidence_quote": null}, {"name": "Intake Completed", "weight": 25, "evidence": "Intake form completed with 3 answers", "evidence_quote": null}], "missing_fields": ["practice_area", "incident_date", "incident_location"]}', 40, '2026-01-06 12:26:54.406', '2026-01-06 12:26:54.406');
INSERT INTO public.qualifications VALUES ('276bd7a9-8928-49ab-9382-c9a7c0e9c967', 'e552396a-e129-4a16-aa24-a016f9dcaba3', '563674fa-228e-4680-9597-a4f72fed1936', 20, 'decline', '{"model": {"model": "qualification-v1", "version": "1.0.0", "provider": "stub"}, "routing": {"notes": "Insufficient information", "practice_area_id": null}, "explanations": ["Lead scored 20/100 based on 1 evaluation factors.", "Missing information: practice_area, intake, incident_date, incident_location."], "disqualifiers": [], "score_factors": [{"name": "Contact Information", "weight": 20, "evidence": "Both phone and email provided", "evidence_quote": null}], "missing_fields": ["practice_area", "intake", "incident_date", "incident_location"]}', 20, '2026-01-06 18:02:47.008', '2026-01-06 18:02:47.008');


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_invites; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: webhook_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.webhook_receipts VALUES ('9c375bdd-c719-477c-8ba1-323bfa39f97d', 'wh_d4538445-af7d-4fbf-a3ae-da07dd0e3908', 'openai', 'realtime.call.incoming', '2026-01-07 08:02:49.804');
INSERT INTO public.webhook_receipts VALUES ('ce1184f8-d277-4538-84ba-cdcf53fb665c', 'wh_2166f3d0-030a-4e1b-b8ac-bb80335b9d90', 'openai', 'realtime.call.incoming', '2026-01-07 08:08:24.361');


--
-- PostgreSQL database dump complete
--

\unrestrict z5DwV940eF5KnjD3Td7tCxr7l77Wx6jZ2MRygKRvS8CvL9oBGWMOnfXoBffgLAI

