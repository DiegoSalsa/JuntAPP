-- Revoke credentials that were published in historical demo fixtures.
-- The historical migrations remain immutable; this forward migration makes any
-- already-created demo identities unusable until an operator assigns credentials.
DO $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
      updated_at = timezone('utc'::text, now())
  WHERE lower(email) IN (
    'admin@juntapp.cl',
    'luis.munoz@correo.cl',
    'directiva.demo@juntapp.cl',
    'vecino.demo@juntapp.cl',
    'tomas.demo@juntapp.cl',
    'ana.demo@juntapp.cl',
    'juan.demo@juntapp.cl',
    'carolina.demo@juntapp.cl',
    'diego.demo@juntapp.cl',
    'elena.demo@juntapp.cl',
    'roberto.demo@juntapp.cl'
  );
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
