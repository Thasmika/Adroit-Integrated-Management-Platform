BEGIN;

INSERT INTO companies (id, name, short) VALUES 
('C01', 'Adroit Enterprises L.L.C Satwa Branch', 'Adroit Satwa'),
('C02', 'Adroit Building Material Trading Enterprises', 'Adroit BMT'),
('C03', 'Al Boom Al Fiddi General Land Transport', 'Al Boom'),
('C04', 'Adroit Enterprises L.L.C Aweer Shop', 'Adroit Aweer'),
('C05', 'Gateway General Land Transport', 'Gateway'),
('C06', 'Technical Workshop Reparing All Cars', 'Technical Workshop'),
('C07', 'Adroit Contracting', 'Adroit Contracting'),
('C08', 'Al Mahara Machinery & Equipment Rental', 'Al Mahara'),
('C09', 'Najam Al Barri Building Equipment Rental', 'Najam Al Barri')
ON CONFLICT (name) DO NOTHING;

UPDATE employees 
SET company = 'Adroit Building Material Trading Enterprises', 
    sponsor = 'Adroit Building Material Trading Enterprises';

DELETE FROM companies 
WHERE id IN ('ABM', 'GGT', 'AGT', 'ATS');

COMMIT;
