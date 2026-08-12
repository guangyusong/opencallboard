INSERT OR IGNORE INTO reviews (
  id, event_id, submission_id, reviewer_user_id, round_id, round,
  scores_json, status, version, created_at, updated_at
)
SELECT
  'review_route_' || s.id || '_' || membership.user_id,
  s.event_id,
  s.id,
  membership.user_id,
  evaluation_round.id,
  s.round,
  '{}',
  'assigned',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM submissions AS s
JOIN evaluation_rounds AS evaluation_round
  ON evaluation_round.event_id = s.event_id
 AND evaluation_round.number = s.round
JOIN event_memberships AS membership
  ON membership.event_id = s.event_id
 AND membership.role = 'reviewer'
WHERE s.review_route IS NOT NULL
  AND membership.user_id = (
    SELECT candidate.user_id
    FROM event_memberships AS candidate
    JOIN users AS candidate_user ON candidate_user.id = candidate.user_id
    WHERE candidate.event_id = s.event_id AND candidate.role = 'reviewer'
    ORDER BY lower(candidate_user.email), candidate.user_id
    LIMIT 1
  );

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (13, 'submission_routing_assignments', CURRENT_TIMESTAMP);
