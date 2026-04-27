-- Clean out everything in correct dependency order
TRUNCATE TABLE bookings, assignments, services, events, users, ministries, organizations CASCADE;

-- Insert Base System Organization (platform owner only)
INSERT INTO organizations (name, slug, industry, status) VALUES ('System Organization', 'system', 'platform', 'Active');

-- Insert Demo Organization (volunteers can register here)
INSERT INTO organizations (name, slug, industry, status) VALUES ('Demo Organization', 'demo', 'general', 'Active');

-- SuperAdmin temporary password: password123
INSERT INTO users (organization_id, name, email, password_hash, role, status, must_change_password) VALUES
(1, 'Oscar CodingSoft', 'contactcodingsoft@gmail.com', '$2b$10$5DsU.7Jt7mbX5RE6EXkFd.79Mp9jvgHLXNyWdO4Xo13bwQRHupGhC', 'SuperAdmin', 'Active', true);
