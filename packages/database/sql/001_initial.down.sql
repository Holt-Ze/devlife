-- Explicit rollback only: removes these five tables and their data.
DROP TABLE run_actions;
DROP TABLE career_runs;
DROP TABLE content_versions;
DROP TABLE events;
DROP TABLE users;
DROP FUNCTION reject_content_version_mutation();
