-- Categorías principales
INSERT INTO categories (id, name, parent_id) VALUES
  (gen_random_uuid(), 'Útiles escolares', NULL),
  (gen_random_uuid(), 'Cartucheras y mochilas', NULL),
  (gen_random_uuid(), 'Papelería', NULL),
  (gen_random_uuid(), 'Uniformes y ropa', NULL),
  (gen_random_uuid(), 'Otros', NULL);

-- Subcategorías de Útiles escolares
INSERT INTO categories (id, name, parent_id, description, min_price_credits, max_price_credits)
VALUES
  (gen_random_uuid(), 'Lápices y lapiceras', (SELECT id FROM categories WHERE name='Útiles escolares'), 'Incluye lápices negros, de colores, lapiceras, bolígrafos, fibras.', 140, 700),
  (gen_random_uuid(), 'Marcadores y resaltadores', (SELECT id FROM categories WHERE name='Útiles escolares'), 'Marcadores escolares, resaltadores de colores.', 280, 1120),
  (gen_random_uuid(), 'Gomas y correctores', (SELECT id FROM categories WHERE name='Útiles escolares'), 'Gomas de borrar, correctores líquidos o en cinta.', 140, 560),
  (gen_random_uuid(), 'Reglas, escuadras y compases', (SELECT id FROM categories WHERE name='Útiles escolares'), 'Set de geometría básico para matemáticas.', 280, 1400);

-- Subcategorías de Cartucheras y mochilas
INSERT INTO categories (id, name, parent_id, description, min_price_credits, max_price_credits)
VALUES
  (gen_random_uuid(), 'Cartucheras', (SELECT id FROM categories WHERE name='Cartucheras y mochilas'), 'Cartucheras de tela, cuero o rígidas.', 700, 2800),
  (gen_random_uuid(), 'Mochilas', (SELECT id FROM categories WHERE name='Cartucheras y mochilas'), 'Mochilas escolares de distintos tamaños.', 2800, 11200);

-- Subcategorías de Papelería
INSERT INTO categories (id, name, parent_id, description, min_price_credits, max_price_credits)
VALUES
  (gen_random_uuid(), 'Cuadernos', (SELECT id FROM categories WHERE name='Papelería'), 'Cuadernos de tapa blanda, dura o anillados.', 560, 2800),
  (gen_random_uuid(), 'Carpetas y repuestos de hojas', (SELECT id FROM categories WHERE name='Papelería'), 'Carpetas A4, A5, con repuestos de hojas rayadas o cuadriculadas.', 1400, 5600),
  (gen_random_uuid(), 'Hojas lisas, cuadriculadas y de colores', (SELECT id FROM categories WHERE name='Papelería'), 'Paquetes de hojas para carpetas o impresiones.', 280, 1400);

-- Subcategorías de Uniformes y ropa
INSERT INTO categories (id, name, parent_id, description, min_price_credits, max_price_credits)
VALUES
  (gen_random_uuid(), 'Camisas y remeras', (SELECT id FROM categories WHERE name='Uniformes y ropa'), 'Camisas de uniforme escolar y remeras con logo.', 2800, 7000),
  (gen_random_uuid(), 'Pantalones y faldas', (SELECT id FROM categories WHERE name='Uniformes y ropa'), 'Pantalones de uniforme y faldas escolares.', 4200, 11200),
  (gen_random_uuid(), 'Buzos y camperas', (SELECT id FROM categories WHERE name='Uniformes y ropa'), 'Buzos, sweaters y camperas escolares.', 5600, 14000),
  (gen_random_uuid(), 'Zapatos escolares', (SELECT id FROM categories WHERE name='Uniformes y ropa'), 'Zapatos de vestir o deportivos para uniforme.', 7000, 16800);

-- Subcategorías de Otros
INSERT INTO categories (id, name, parent_id, description, min_price_credits, max_price_credits)
VALUES
  (gen_random_uuid(), 'Botellas de agua y loncheras', (SELECT id FROM categories WHERE name='Otros'), 'Botellas reutilizables, loncheras escolares.', 560, 2800),
  (gen_random_uuid(), 'Material artístico', (SELECT id FROM categories WHERE name='Otros'), 'Acuarelas, témperas, pinceles, crayones.', 560, 4200);
