-- Domisili Indonesia vs luar negeri + kode Wilayah.id
ALTER TABLE users ADD COLUMN address_scope VARCHAR(8) NOT NULL DEFAULT 'ID';
ALTER TABLE users ADD COLUMN address_country VARCHAR(2) NOT NULL DEFAULT 'ID';
ALTER TABLE users ADD COLUMN province_code VARCHAR(8) NULL;
ALTER TABLE users ADD COLUMN city_code VARCHAR(12) NULL;
ALTER TABLE users ADD COLUMN district_code VARCHAR(16) NULL;
ALTER TABLE users ADD COLUMN village_code VARCHAR(20) NULL;

CREATE INDEX users_address_scope_idx ON users(address_scope);
CREATE INDEX users_address_country_idx ON users(address_country);

-- Backfill: yang sudah punya alamat ID dianggap Indonesia
UPDATE users SET address_scope = 'ID', address_country = 'ID'
WHERE province IS NOT NULL OR city IS NOT NULL OR address_line IS NOT NULL OR address IS NOT NULL;
