-- push_config contains internal secrets and VAPID private key material.
REVOKE ALL ON TABLE public.push_config FROM anon, authenticated;
GRANT SELECT ON TABLE public.push_config TO service_role;
