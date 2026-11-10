BEGIN;
CREATE TABLE IF NOT EXISTS vehicle_catalog (
 id bigserial PRIMARY KEY,
 brand varchar(100) NOT NULL,
 model varchar(100) NOT NULL,
 trim_name varchar(120) NOT NULL DEFAULT '',
 source varchar(24) NOT NULL DEFAULT 'carvamo',
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT vehicle_catalog_unique UNIQUE (brand,model,trim_name)
);
CREATE INDEX IF NOT EXISTS vehicle_catalog_brand_model ON vehicle_catalog (brand,model);
INSERT INTO vehicle_catalog(brand,model) VALUES
('OMODA','5'),('OMODA','9'),('JAECOO','7'),('JAECOO','5'),
('MG','ZS'),('MG','HS'),('MG','MG4'),('BYD','Seal'),('BYD','Atto 3'),
('MAXUS','Deliver 9'),('MAXUS','eDeliver 3'),('Toyota','Corolla'),
('Toyota','Yaris'),('Toyota','RAV4'),('Lexus','NX'),('Lexus','RX'),
('Hyundai','Tucson'),('Kia','Sportage'),('Volkswagen','Golf'),
('Volkswagen','Tiguan'),('Skoda','Octavia'),('Skoda','Superb'),
('Renault','Clio'),('Dacia','Duster'),('Peugeot','3008'),
('Ford','Kuga'),('BMW','3'),('Mercedes-Benz','Klasa C'),
('Audi','A4'),('Volvo','XC60'),('Mitsubishi','Outlander'),
('Foton','Tunland'),('Jetour','T2')
ON CONFLICT DO NOTHING;
COMMIT;
