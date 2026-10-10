DROP TRIGGER IF EXISTS patients_validate_insert;
DROP TRIGGER IF EXISTS patients_validate_update;

CREATE TRIGGER patients_validate_insert
BEFORE INSERT ON patients
BEGIN
  SELECT (CASE WHEN NOT (
    length(NEW.phone_number) = 12 AND
    substr(NEW.phone_number, 1, 2) = '+1' AND
    substr(NEW.phone_number, 3) NOT GLOB '*[^0-9]*' AND
    substr(NEW.phone_number, 3, 1) NOT IN ('0', '1') AND
    substr(NEW.phone_number, 6, 1) NOT IN ('0', '1')
  ) THEN RAISE(ABORT, 'invalid phone_number') END);
  SELECT (CASE WHEN NEW.emergency_contact_phone IS NOT NULL AND NOT (
    length(NEW.emergency_contact_phone) = 12 AND
    substr(NEW.emergency_contact_phone, 1, 2) = '+1' AND
    substr(NEW.emergency_contact_phone, 3) NOT GLOB '*[^0-9]*' AND
    substr(NEW.emergency_contact_phone, 3, 1) NOT IN ('0', '1') AND
    substr(NEW.emergency_contact_phone, 6, 1) NOT IN ('0', '1')
  ) THEN RAISE(ABORT, 'invalid emergency_contact_phone') END);
  SELECT (CASE WHEN NEW.state NOT IN ('AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC')
    THEN RAISE(ABORT, 'invalid state') END);
  SELECT (CASE WHEN NOT (
    (length(NEW.zip_code) = 5 AND NEW.zip_code NOT GLOB '*[^0-9]*') OR
    (length(NEW.zip_code) = 10 AND substr(NEW.zip_code, 6, 1) = '-' AND replace(NEW.zip_code, '-', '') NOT GLOB '*[^0-9]*')
  ) THEN RAISE(ABORT, 'invalid zip_code') END);
END;

CREATE TRIGGER patients_validate_update
BEFORE UPDATE ON patients
BEGIN
  SELECT (CASE WHEN NOT (
    length(NEW.phone_number) = 12 AND
    substr(NEW.phone_number, 1, 2) = '+1' AND
    substr(NEW.phone_number, 3) NOT GLOB '*[^0-9]*' AND
    substr(NEW.phone_number, 3, 1) NOT IN ('0', '1') AND
    substr(NEW.phone_number, 6, 1) NOT IN ('0', '1')
  ) THEN RAISE(ABORT, 'invalid phone_number') END);
  SELECT (CASE WHEN NEW.emergency_contact_phone IS NOT NULL AND NOT (
    length(NEW.emergency_contact_phone) = 12 AND
    substr(NEW.emergency_contact_phone, 1, 2) = '+1' AND
    substr(NEW.emergency_contact_phone, 3) NOT GLOB '*[^0-9]*' AND
    substr(NEW.emergency_contact_phone, 3, 1) NOT IN ('0', '1') AND
    substr(NEW.emergency_contact_phone, 6, 1) NOT IN ('0', '1')
  ) THEN RAISE(ABORT, 'invalid emergency_contact_phone') END);
  SELECT (CASE WHEN NEW.state NOT IN ('AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC')
    THEN RAISE(ABORT, 'invalid state') END);
  SELECT (CASE WHEN NOT (
    (length(NEW.zip_code) = 5 AND NEW.zip_code NOT GLOB '*[^0-9]*') OR
    (length(NEW.zip_code) = 10 AND substr(NEW.zip_code, 6, 1) = '-' AND replace(NEW.zip_code, '-', '') NOT GLOB '*[^0-9]*')
  ) THEN RAISE(ABORT, 'invalid zip_code') END);
END;
