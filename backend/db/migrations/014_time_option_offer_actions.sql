CREATE TABLE time_option_offer_actions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offer_id INT NOT NULL REFERENCES time_option_offers (id) ON DELETE CASCADE,
  actor_user_id INT REFERENCES users (id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('withdrawn', 'declined')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX time_option_offer_actions_offer_idx
  ON time_option_offer_actions (offer_id);
