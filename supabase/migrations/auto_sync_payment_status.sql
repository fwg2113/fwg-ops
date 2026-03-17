-- Auto-sync document payment status when payments change
-- This trigger ensures documents always reflect the correct payment status

-- Function to sync document payment status
CREATE OR REPLACE FUNCTION sync_document_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid NUMERIC;
  doc_total NUMERIC;
  new_balance NUMERIC;
  new_status TEXT;
  last_payment_date TIMESTAMP;
BEGIN
  -- Get document total
  SELECT total INTO doc_total
  FROM documents
  WHERE id = COALESCE(NEW.document_id, OLD.document_id);

  -- Calculate total paid from all payments, excluding processing fees
  SELECT COALESCE(SUM(amount - COALESCE(processing_fee, 0)), 0) INTO total_paid
  FROM payments
  WHERE document_id = COALESCE(NEW.document_id, OLD.document_id);

  -- Calculate balance
  new_balance := doc_total - total_paid;
  IF new_balance < 0 THEN
    new_balance := 0;
  END IF;

  -- Determine status
  IF total_paid = 0 THEN
    new_status := 'sent'; -- No payments yet
  ELSIF new_balance = 0 THEN
    new_status := 'paid'; -- Fully paid
  ELSE
    new_status := 'partial'; -- Partially paid
  END IF;

  -- Get the last payment date (when fully paid)
  IF new_balance = 0 AND total_paid > 0 THEN
    SELECT MAX(created_at) INTO last_payment_date
    FROM payments
    WHERE document_id = COALESCE(NEW.document_id, OLD.document_id);
  ELSE
    last_payment_date := NULL;
  END IF;

  -- Update the document
  UPDATE documents
  SET
    amount_paid = total_paid,
    balance_due = new_balance,
    status = new_status,
    paid_at = last_payment_date
  WHERE id = COALESCE(NEW.document_id, OLD.document_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS sync_payment_on_insert ON payments;
CREATE TRIGGER sync_payment_on_insert
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_document_payment_status();

-- Create trigger for UPDATE
DROP TRIGGER IF EXISTS sync_payment_on_update ON payments;
CREATE TRIGGER sync_payment_on_update
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_document_payment_status();

-- Create trigger for DELETE
DROP TRIGGER IF EXISTS sync_payment_on_delete ON payments;
CREATE TRIGGER sync_payment_on_delete
  AFTER DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_document_payment_status();
