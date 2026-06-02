The banner is still showing because the Dashboard prompt only checks `user_pco_connections` for the current user. When you connected Planning Center at the org/admin integration level, that creates/updates the org `integrations` row, but it may not create a matching personal `user_pco_connections` row for that same admin. So the prompt thinks your personal connection is missing and shows the banner/dialog.

Plan:
1. Update the Dashboard prompt logic so org owners/admins who are the connected org OAuth user are treated as connected.
   - Check the Planning Center integration fields: `oauth_connected_by_user_id`, `auth_type`, and `status`.
   - If `oauth_connected_by_user_id === current user.id` and the integration is active OAuth, suppress the banner/dialog.
2. Keep the existing prompt for regular users who have no personal connection, and keep the reconnect prompt for users whose personal connection is `reauth_required`.
3. Update the prompt query to read from the safe public integration data where appropriate, avoiding token fields.
4. Verify the component no longer renders the prompt for the connected admin case while still prompting unconnected users.