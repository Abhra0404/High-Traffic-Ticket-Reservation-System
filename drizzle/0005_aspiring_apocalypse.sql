CREATE INDEX "event_seats_event_id_idx" ON "event_seats" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "outbox_events_processed_at_idx" ON "outbox_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "outbox_events_claimed_at_idx" ON "outbox_events" USING btree ("claimed_at");--> statement-breakpoint
CREATE INDEX "reservations_user_id_idx" ON "reservations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reservations_expires_at_idx" ON "reservations" USING btree ("expires_at");