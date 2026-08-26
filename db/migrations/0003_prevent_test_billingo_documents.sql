BEGIN;

CREATE OR REPLACE FUNCTION prevent_test_billingo_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.provider = 'billingo' AND EXISTS (
    SELECT 1
    FROM applications
    WHERE id = NEW.application_id AND is_test = true
  ) THEN
    RAISE EXCEPTION 'TESZT jelentkezéshez Billingo-bizonylat nem készíthető.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_documents_prevent_test_billingo ON invoice_documents;

CREATE TRIGGER invoice_documents_prevent_test_billingo
BEFORE INSERT OR UPDATE OF application_id, provider ON invoice_documents
FOR EACH ROW
EXECUTE FUNCTION prevent_test_billingo_document();

CREATE OR REPLACE FUNCTION prevent_payment_item_overpayment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item_amount_huf integer;
  paid_amount_huf integer;
BEGIN
  SELECT amount_huf
  INTO item_amount_huf
  FROM payment_items
  WHERE id = NEW.payment_item_id
  FOR UPDATE;

  SELECT coalesce(sum(amount_huf), 0)::int
  INTO paid_amount_huf
  FROM payments
  WHERE payment_item_id = NEW.payment_item_id
    AND id <> NEW.id;

  IF paid_amount_huf + NEW.amount_huf > item_amount_huf THEN
    RAISE EXCEPTION 'A befizetés meghaladná a fizetési tétel fennmaradó összegét.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_prevent_overpayment ON payments;

CREATE TRIGGER payments_prevent_overpayment
BEFORE INSERT OR UPDATE OF payment_item_id, amount_huf ON payments
FOR EACH ROW
EXECUTE FUNCTION prevent_payment_item_overpayment();

COMMIT;
