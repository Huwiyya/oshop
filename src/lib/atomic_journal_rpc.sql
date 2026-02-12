-- RPC: create_complete_journal_rpc
-- This function handles creating a journal entry AND updating inventory atomically.
-- It supports FIFO layer consumption for inventory decreases.
-- Updated: Robust entry_number generation with retry logic.

CREATE OR REPLACE FUNCTION create_complete_journal_rpc(
  p_entry_date DATE,
  p_description TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_lines JSONB -- Array of objects: { accountId, debit, credit, description, inventoryItemId, quantity }
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id UUID;
  v_total_debit DECIMAL := 0;
  v_total_credit DECIMAL := 0;
  v_line JSONB;
  v_line_number INT := 1;
  v_qty DECIMAL;
  v_unit_cost DECIMAL;
  v_layer_id UUID;
  v_remaining_qty DECIMAL;
  v_layer RECORD;
  v_qty_to_consume DECIMAL;
  v_consume_amount DECIMAL;
  
  -- Variables for Entry Number Generation
  v_date_str TEXT;
  v_seq INT;
  v_entry_num TEXT;
  v_retry INT;
BEGIN
  -- 1. Calculate Totals & Validate Balance
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::DECIMAL, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::DECIMAL, 0);
  END LOOP;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debit: %, Credit: %', v_total_debit, v_total_credit;
  END IF;

  -- 2. Generate Entry Number & Insert (with Robust Retry)
  v_date_str := to_char(p_entry_date, 'YYYYMMDD');
  
  FOR v_retry IN 1..10 LOOP
      BEGIN
          -- Calculate explicitly from DB using STRICT regex (end of string) to ignore hex noise
          SELECT COALESCE(MAX(SUBSTRING(entry_number FROM 'JE-' || v_date_str || '-(\d+)$')::INT), 0) + 1
          INTO v_seq
          FROM journal_entries
          WHERE entry_number LIKE 'JE-' || v_date_str || '-%';

          -- If this is a retry (v_retry > 1), maybe our view is stale or we collided.
          -- Add retry offset to jump ahead if needed (heuristic)
          IF v_retry > 1 THEN
             v_seq := v_seq + (v_retry - 1);
          END IF;
          
          v_entry_num := 'JE-' || v_date_str || '-' || lpad(v_seq::text, 4, '0');
          
          -- Primary Check: Does it verifyably exist?
          IF EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = v_entry_num) THEN
             -- If it exists, loop again calling MAX (should be higher now) or increment manually
             CONTINUE;
          END IF;
          
          -- Try Insert
          INSERT INTO journal_entries (
            entry_number,
            entry_date, description, reference_type, reference_id, 
            total_debit, total_credit, is_posted, created_at, updated_at
          ) VALUES (
            v_entry_num,
            p_entry_date, p_description, p_reference_type, p_reference_id,
            v_total_debit, v_total_credit, true, NOW(), NOW()
          ) RETURNING id INTO v_entry_id;
          
          -- If successful, exit loop
          EXIT; 
          
      EXCEPTION WHEN unique_violation THEN
          -- Collision happened despite check (race condition)
          IF v_retry = 10 THEN RAISE; END IF;
          -- Wait briefly to let other tx commit
          PERFORM pg_sleep(0.1);
      END;
  END LOOP;

  -- 4. Process Lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    -- Insert Journal Entry Line
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, description, debit, credit, line_number
    ) VALUES (
      v_entry_id, 
      (v_line->>'accountId')::UUID, 
      COALESCE(v_line->>'description', p_description), 
      COALESCE((v_line->>'debit')::DECIMAL, 0), 
      COALESCE((v_line->>'credit')::DECIMAL, 0), 
      v_line_number
    );
    v_line_number := v_line_number + 1;

    -- 4. Inventory Logic (If Item ID is present)
    IF (v_line->>'inventoryItemId') IS NOT NULL THEN
      v_qty := COALESCE((v_line->>'quantity')::DECIMAL, 0);
      
      IF v_qty <> 0 THEN
        -- A. Update Inventory Item (Quantity On Hand)
        UPDATE inventory_items 
        SET quantity_on_hand = quantity_on_hand + v_qty,
            updated_at = NOW()
        WHERE id = (v_line->>'inventoryItemId')::UUID;

        -- B. Handle Transactions & Layers
        IF v_qty > 0 THEN
           -- INCREASE: Create Layer
           v_unit_cost := CASE WHEN v_qty > 0 THEN (v_line->>'debit')::DECIMAL / v_qty ELSE 0 END;
           
           INSERT INTO inventory_layers (
             item_id, quantity, remaining_quantity, unit_cost, created_at
           ) VALUES (
             (v_line->>'inventoryItemId')::UUID, 
             v_qty, 
             v_qty, 
             v_unit_cost, 
             p_entry_date
           ) RETURNING id INTO v_layer_id;

           -- Create Transaction
           INSERT INTO inventory_transactions (
             item_id, transaction_type, transaction_date, quantity, 
             unit_cost, total_cost, journal_entry_id, layer_id, description
           ) VALUES (
             (v_line->>'inventoryItemId')::UUID, 
             'journal_entry', 
             p_entry_date, 
             v_qty, 
             v_unit_cost, 
             (v_line->>'debit')::DECIMAL, 
             v_entry_id, 
             v_layer_id, 
             p_description
           );
           
        ELSE
           -- DECREASE: Consume Layers (FIFO)
           v_qty_to_consume := ABS(v_qty);
           
           -- Iterate strictly open layers ordered by date
           FOR v_layer IN SELECT * FROM inventory_layers 
                          WHERE item_id = (v_line->>'inventoryItemId')::UUID 
                            AND remaining_quantity > 0 
                          ORDER BY created_at ASC 
           LOOP
             EXIT WHEN v_qty_to_consume <= 0;
             
             IF v_layer.remaining_quantity >= v_qty_to_consume THEN
               v_consume_amount := v_qty_to_consume;
             ELSE
               v_consume_amount := v_layer.remaining_quantity;
             END IF;
             
             -- Update Layer
             UPDATE inventory_layers 
             SET remaining_quantity = remaining_quantity - v_consume_amount 
             WHERE id = v_layer.id;
             
             v_qty_to_consume := v_qty_to_consume - v_consume_amount;
           END LOOP;

           -- Create Transaction (Outgoing)
           v_unit_cost := CASE WHEN ABS(v_qty) > 0 THEN (v_line->>'credit')::DECIMAL / ABS(v_qty) ELSE 0 END;

           INSERT INTO inventory_transactions (
             item_id, transaction_type, transaction_date, quantity, 
             unit_cost, total_cost, journal_entry_id, description
           ) VALUES (
             (v_line->>'inventoryItemId')::UUID, 
             'journal_entry', 
             p_entry_date, 
             v_qty, 
             v_unit_cost, 
             (v_line->>'credit')::DECIMAL, 
             v_entry_id, 
             p_description
           );
        END IF;

      END IF;
    END IF;
  END LOOP;

  RETURN v_entry_id;
END;
$$;
