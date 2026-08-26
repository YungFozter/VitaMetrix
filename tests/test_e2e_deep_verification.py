import unittest
import json
import os
from backend.app import (
    app, 
    _TAXONOMIES_PATH, 
    _STOCK_ITEMS_PATH, 
    _STOCK_MOVEMENTS_PATH, 
    _APPOINTMENTS_PATH, 
    _SALES_PATH
)

class TestE2EDeepVerification(unittest.TestCase):
    """
    Test Suite E2E Completo y Profundo para la permanencia de datos de:
    - Categorías y Taxonomías
    - Unidades de Medida
    - Inventario de Stock y todos sus campos
    - Movimientos Kardex
    - Ventas POS y Anulaciones
    - Citas y Agenda Clínica
    """

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_1_category_lifecycle_and_disk_persistence(self):
        """Prueba creación, búsqueda, actualización, persistencia en disco y eliminación de Categorías."""
        import time
        t_id = int(time.time() * 1000)
        cat_name = f"Suplementos Botánicos E2E {t_id}"
        cat_icon = "🌿"
        cat_desc = "Fitoterapia y extractos botánicos clínicos"

        # 1. Crear categoría
        res = self.app.post('/api/stock/taxonomies/category',
                            data=json.dumps({"name": cat_name, "icon": cat_icon, "description": cat_desc}),
                            content_type='application/json')
        self.assertIn(res.status_code, [200, 201])
        res_json = json.loads(res.data)
        self.assertTrue(res_json.get('success'))

        # 2. Verificar que existe en endpoint GET
        res_get = self.app.get('/api/stock/taxonomies')
        self.assertEqual(res_get.status_code, 200)
        tax_data = json.loads(res_get.data)
        found_cat = next((c for c in tax_data.get('categories', []) if c['name'] == cat_name), None)
        self.assertIsNotNone(found_cat, f"Categoría {cat_name} no encontrada en GET /api/stock/taxonomies")
        self.assertEqual(found_cat.get('icon'), cat_icon)

        # 3. Verificar persistencia física en data/stock_taxonomies.json
        self.assertTrue(os.path.exists(_TAXONOMIES_PATH), "El archivo stock_taxonomies.json debe existir en disco")
        with open(_TAXONOMIES_PATH, 'r', encoding='utf-8') as f:
            disk_data = json.load(f)
            disk_cat = next((c for c in disk_data.get('categories', []) if c['name'] == cat_name), None)
            self.assertIsNotNone(disk_cat, "La categoría debe estar físicamente persistida en stock_taxonomies.json")

        # 4. Actualizar / Renombrar Categoría
        renamed_cat = f"Fitoterapia Clínica E2E {t_id}"
        res_ren = self.app.put('/api/stock/taxonomies/category',
                               data=json.dumps({"old_name": cat_name, "new_name": renamed_cat}),
                               content_type='application/json')
        self.assertEqual(res_ren.status_code, 200)

        # Verificar que el nuevo nombre persiste en disco
        with open(_TAXONOMIES_PATH, 'r', encoding='utf-8') as f:
            disk_data = json.load(f)
            self.assertTrue(any(c['name'] == renamed_cat for c in disk_data.get('categories', [])))
            self.assertFalse(any(c['name'] == cat_name for c in disk_data.get('categories', [])))

        # 5. Eliminar Categoría de prueba
        res_del = self.app.delete(f'/api/stock/taxonomies/category/{renamed_cat}')
        self.assertEqual(res_del.status_code, 200)

    def test_2_stock_items_all_fields_and_auto_category_persistence(self):
        """Prueba creación de insumo con todos los campos y auto-registro de categoría no existente."""
        auto_cat = "Insumos Láser y Termoterapia E2E"
        auto_unit = "Kit Terapéutico (kit)"

        item_payload = {
            "code": "TERMO-E2E-001",
            "name": "Kit Electrodos Térmicos y Gel BIA E2E",
            "category": auto_cat,
            "unit": auto_unit,
            "stock_quantity": 35.5,
            "min_stock": 10.0,
            "cost_price": 75.25,
            "sale_price": 120.0,
            "supplier": "BioMedica Andina S.A.",
            "location": "Gabinete 3 - Módulo B",
            "batch_number": "LOTE-2026-BIA",
            "expiry_date": "2028-06-30",
            "notes": "Insumo de prueba con todos los campos auditados para E2E"
        }

        # 1. Crear producto con categoría y unidad que no estaban previamente
        res = self.app.post('/api/stock',
                            data=json.dumps(item_payload),
                            content_type='application/json')
        self.assertIn(res.status_code, [200, 201])
        item_data = json.loads(res.data).get('data', {})
        item_id = item_data.get('id')
        self.assertIsNotNone(item_id)

        # 2. Verificar que la categoría y unidad se auto-registraron en stock_taxonomies.json
        with open(_TAXONOMIES_PATH, 'r', encoding='utf-8') as f:
            disk_tax = json.load(f)
            self.assertTrue(any(c['name'].lower() == auto_cat.lower() for c in disk_tax.get('categories', [])),
                            "La categoría auto-registrada debe persistir en stock_taxonomies.json")
            self.assertTrue(any(u['name'].lower() == auto_unit.lower() for u in disk_tax.get('units', [])),
                            "La unidad auto-registrada debe persistir en stock_taxonomies.json")

        # 3. Verificar que el producto está guardado físicamente en data/stock_items.json con TODOS los campos
        self.assertTrue(os.path.exists(_STOCK_ITEMS_PATH), "El archivo stock_items.json debe existir en disco")
        with open(_STOCK_ITEMS_PATH, 'r', encoding='utf-8') as f:
            disk_items = json.load(f)
            saved_item = next((i for i in disk_items if i['id'] == item_id or i.get('code') == item_payload['code']), None)
            self.assertIsNotNone(saved_item, "El producto debe existir en stock_items.json")
            self.assertEqual(saved_item.get('name'), item_payload['name'])
            self.assertEqual(saved_item.get('category'), auto_cat)
            self.assertEqual(saved_item.get('unit'), auto_unit)
            self.assertEqual(float(saved_item.get('cost_price')), 75.25)
            self.assertEqual(float(saved_item.get('sale_price')), 120.0)
            self.assertEqual(saved_item.get('batch_number'), "LOTE-2026-BIA")
            self.assertEqual(saved_item.get('expiry_date'), "2028-06-30")
            self.assertEqual(saved_item.get('location'), "Gabinete 3 - Módulo B")
            self.assertEqual(saved_item.get('supplier'), "BioMedica Andina S.A.")

        # 4. Modificar producto y verificar persistencia
        update_payload = {
            "name": "Kit Electrodos Térmicos y Gel BIA E2E - Actualizado",
            "stock_quantity": 40.0,
            "sale_price": 135.0,
            "location": "Gabinete 3 - Módulo A (Reubicado)"
        }
        res_put = self.app.put(f'/api/stock/{item_id}',
                               data=json.dumps(update_payload),
                               content_type='application/json')
        self.assertEqual(res_put.status_code, 200)

        with open(_STOCK_ITEMS_PATH, 'r', encoding='utf-8') as f:
            disk_items = json.load(f)
            updated_item = next((i for i in disk_items if i['id'] == item_id), None)
            self.assertIsNotNone(updated_item)
            self.assertEqual(updated_item.get('name'), "Kit Electrodos Térmicos y Gel BIA E2E - Actualizado")
            self.assertEqual(float(updated_item.get('stock_quantity')), 40.0)
            self.assertEqual(float(updated_item.get('sale_price')), 135.0)
            self.assertEqual(updated_item.get('location'), "Gabinete 3 - Módulo A (Reubicado)")

        # 5. Probar Movimiento de Kardex (Salida de stock)
        mov_payload = {
            "type": "OUT",
            "quantity": 5.0,
            "reason": "Uso en demostración clínica BIVA"
        }
        res_mov = self.app.post(f'/api/stock/{item_id}/movement',
                                data=json.dumps(mov_payload),
                                content_type='application/json')
        self.assertEqual(res_mov.status_code, 200)

        # Verificar que el stock bajó a 35.0 y se registró en stock_movements.json
        with open(_STOCK_ITEMS_PATH, 'r', encoding='utf-8') as f:
            disk_items = json.load(f)
            mov_item = next((i for i in disk_items if i['id'] == item_id), None)
            self.assertEqual(float(mov_item.get('stock_quantity')), 35.0)

        with open(_STOCK_MOVEMENTS_PATH, 'r', encoding='utf-8') as f:
            disk_movs = json.load(f)
            mov_found = next((m for m in disk_movs if m.get('stock_item_id') == item_id and m.get('type') == 'OUT'), None)
            self.assertIsNotNone(mov_found, "El movimiento OUT debe persistir en stock_movements.json")
            self.assertEqual(float(mov_found.get('quantity')), 5.0)

        # 6. Limpieza
        self.app.delete(f'/api/stock/{item_id}')
        self.app.delete(f'/api/stock/taxonomies/category/{auto_cat}')

    def test_3_pos_sales_kardex_restitution_and_persistence(self):
        """Prueba flujo completo de ventas POS, afectación de stock, kardex y anulación con persistencia en disco."""
        # 1. Crear producto temporal para venta
        item_payload = {
            "code": "PROT-POS-E2E",
            "name": "Proteína Whey E2E Test 1kg",
            "category": "Suplementos Nutricionales",
            "unit": "Frasco / Bote",
            "stock_quantity": 25.0,
            "min_stock": 5.0,
            "cost_price": 50.0,
            "sale_price": 90.0
        }
        res_item = self.app.post('/api/stock', data=json.dumps(item_payload), content_type='application/json')
        item_id = json.loads(res_item.data).get('data', {}).get('id')

        # 2. Registrar Venta
        sale_payload = {
            "patient_name": "Paciente E2E Prueba",
            "patient_idp": "IDP-9999",
            "patient_phone": "+59177889900",
            "payment_method": "Efectivo",
            "discount": 5.0,
            "amount_received": 200.0,
            "items": [
                {
                    "stock_item_id": item_id,
                    "quantity": 2.0,
                    "unit_price": 90.0
                }
            ]
        }
        res_sale = self.app.post('/api/sales', data=json.dumps(sale_payload), content_type='application/json')
        self.assertEqual(res_sale.status_code, 201)
        sale_data = json.loads(res_sale.data).get('sale', {})
        sale_id = sale_data.get('id')
        self.assertEqual(sale_data.get('total'), 175.0) # (90*2) - 5 = 175

        # 3. Verificar persistencia de la venta en data/sales.json
        self.assertTrue(os.path.exists(_SALES_PATH))
        with open(_SALES_PATH, 'r', encoding='utf-8') as f:
            disk_sales = json.load(f)
            saved_sale = next((s for s in disk_sales if s['id'] == sale_id), None)
            self.assertIsNotNone(saved_sale, "La venta debe estar guardada en sales.json")

        # 4. Verificar que el stock bajó de 25 a 23 en stock_items.json
        with open(_STOCK_ITEMS_PATH, 'r', encoding='utf-8') as f:
            disk_items = json.load(f)
            sold_item = next((i for i in disk_items if i['id'] == item_id), None)
            self.assertEqual(float(sold_item.get('stock_quantity')), 23.0)

        # 5. Anular venta y verificar restitución
        res_cancel = self.app.delete(f'/api/sales/{sale_id}')
        self.assertEqual(res_cancel.status_code, 200)

        # Verificar en sales.json que el status es CANCELLED
        with open(_SALES_PATH, 'r', encoding='utf-8') as f:
            disk_sales = json.load(f)
            cancelled_sale = next((s for s in disk_sales if s['id'] == sale_id), None)
            self.assertEqual(cancelled_sale.get('status'), 'CANCELLED')

        # Verificar que el stock volvió a 25.0 en stock_items.json
        with open(_STOCK_ITEMS_PATH, 'r', encoding='utf-8') as f:
            disk_items = json.load(f)
            restored_item = next((i for i in disk_items if i['id'] == item_id), None)
            self.assertEqual(float(restored_item.get('stock_quantity')), 25.0)

        # 6. Limpieza
        self.app.delete(f'/api/stock/{item_id}')

    def test_4_appointments_lifecycle_and_persistence(self):
        """Prueba creación, lectura, actualización y persistencia en disco de citas clínicas."""
        appt_payload = {
            "patient_name": "Valeria Morales E2E",
            "patient_phone": "+59171234567",
            "patient_idp": "IDP-0042",
            "date": "2026-09-15",
            "time": "10:30",
            "type": "Control de Seguimiento BIVA",
            "status": "confirmed",
            "notes": "Paciente para evaluación mensual de Masa Muscular y Ángulo de Fase"
        }

        # 1. Crear cita
        res = self.app.post('/api/appointments', data=json.dumps(appt_payload), content_type='application/json')
        self.assertIn(res.status_code, [200, 201])
        appt_id = json.loads(res.data).get('data', {}).get('id')
        self.assertIsNotNone(appt_id)

        # 2. Verificar que existe en endpoint
        res_get = self.app.get('/api/appointments?date=2026-09-15')
        self.assertEqual(res_get.status_code, 200)
        appts = json.loads(res_get.data)
        found_appt = next((a for a in appts if a.get('patient_name') == appt_payload['patient_name']), None)
        self.assertIsNotNone(found_appt)

        # 3. Verificar persistencia física en data/appointments.json si se usa almacenamiento local
        if os.path.exists(_APPOINTMENTS_PATH):
            with open(_APPOINTMENTS_PATH, 'r', encoding='utf-8') as f:
                disk_appts = json.load(f)
                self.assertTrue(any(a.get('patient_name') == appt_payload['patient_name'] for a in disk_appts))

        # 4. Actualizar cita
        res_put = self.app.put(f'/api/appointments/{appt_id}',
                               data=json.dumps({"status": "completed", "notes": "Evaluación realizada con éxito"}),
                               content_type='application/json')
        self.assertEqual(res_put.status_code, 200)

        # 5. Eliminar cita de prueba
        self.app.delete(f'/api/appointments/{appt_id}')

    def test_5_bulk_delete_stock_items(self):
        """Prueba la eliminación masiva de múltiples productos en una sola llamada atómica."""
        import time
        t_id = int(time.time() * 1000)
        
        # Crear 3 productos temporales
        item_ids = []
        for i in range(1, 4):
            payload = {
                "code": f"BLK-{i}-{t_id % 10000}",
                "name": f"Insumo Bulk Test {i}",
                "category": "Insumos BIA",
                "unit": "Unidad (u)",
                "stock_quantity": 10,
                "min_stock": 2,
                "cost_price": 50,
                "sale_price": 80
            }
            res = self.app.post('/api/stock', data=json.dumps(payload), content_type='application/json')
            self.assertIn(res.status_code, [200, 201])
            item_id = json.loads(res.data).get('data', {}).get('id')
            if item_id:
                item_ids.append(item_id)

        self.assertEqual(len(item_ids), 3)

        # Ejecutar eliminación masiva (POST /api/stock/bulk-delete)
        res_bulk = self.app.post('/api/stock/bulk-delete',
                                 data=json.dumps({"ids": item_ids}),
                                 content_type='application/json')
        self.assertEqual(res_bulk.status_code, 200)
        res_json = json.loads(res_bulk.data)
        self.assertTrue(res_json.get('success'))
        self.assertEqual(res_json.get('deleted_count'), 3)

        # Verificar que ya no existen en GET /api/stock
        res_get = self.app.get('/api/stock')
        self.assertEqual(res_get.status_code, 200)
        current_items = json.loads(res_get.data)
        for i_id in item_ids:
            self.assertFalse(any(it.get('id') == i_id for it in current_items))

    def test_6_stock_security_and_sanitization(self):
        """Auditoría de Seguridad: Inyección XSS, números negativos, desbordamiento y manejo de errores seguros."""
        # 1. Intento de inyección HTML/script en nombre y campos
        malicious_payload = {
            "code": "<script>alert('xss')</script>",
            "name": "<img src=x onerror=alert(1)> Electrodo Gel",
            "category": "<svg onload=alert(2)>",
            "unit": "<script>",
            "stock_quantity": -50,  # Valor negativo -> debe corregirse a >= 0
            "min_stock": -10,
            "cost_price": "invalid_price",  # String en float -> debe fallback a 0.0
            "sale_price": -99.9
        }
        res = self.app.post('/api/stock', data=json.dumps(malicious_payload), content_type='application/json')
        self.assertIn(res.status_code, [200, 201])
        item_data = json.loads(res.data).get('data', {})
        self.assertIsNotNone(item_data.get('id'))
        
        # Validar que los valores numéricos fueron saneados a >= 0
        self.assertGreaterEqual(item_data.get('stock_quantity', 0), 0)
        self.assertGreaterEqual(item_data.get('min_stock', 0), 0)
        self.assertGreaterEqual(item_data.get('cost_price', 0), 0)
        self.assertGreaterEqual(item_data.get('sale_price', 0), 0)

        # 2. Intento de crear producto sin nombre (debe retornar 400 Bad Request)
        res_empty = self.app.post('/api/stock', data=json.dumps({"name": "   "}), content_type='application/json')
        self.assertEqual(res_empty.status_code, 400)

        # 3. Intento de actualizar producto inexistente (debe retornar 404 o manejarlo limpiamente)
        res_404 = self.app.put('/api/stock/non-existent-id-9999',
                               data=json.dumps({"name": "Nuevo Nombre"}),
                               content_type='application/json')
        self.assertIn(res_404.status_code, [404, 400])

        # 4. Intento de bulk delete con payload inválido
        res_bad_bulk = self.app.post('/api/stock/bulk-delete', data=json.dumps({"ids": "not_a_list"}), content_type='application/json')
        self.assertEqual(res_bad_bulk.status_code, 400)

        # Limpiar ítem de prueba
        if item_data.get('id'):
            self.app.delete(f'/api/stock/{item_data["id"]}')

    def test_7_kardex_movements_integrity(self):
        """Auditoría de integridad de Kardex: Entradas, Salidas y Ajustes con cálculo de saldos."""
        import time
        t_id = int(time.time() * 1000)
        
        # 1. Crear producto base con stock 20
        payload = {
            "code": f"KDX-{t_id % 10000}",
            "name": f"Insumo Kardex Test {t_id}",
            "category": "Insumos BIA",
            "stock_quantity": 20,
            "min_stock": 5,
            "cost_price": 30,
            "sale_price": 50
        }
        res = self.app.post('/api/stock', data=json.dumps(payload), content_type='application/json')
        self.assertIn(res.status_code, [200, 201])
        item_id = json.loads(res.data).get('data', {}).get('id')
        self.assertIsNotNone(item_id)

        # 2. Registrar Entrada (IN +15) -> nuevo stock 35
        res_in = self.app.post(f'/api/stock/{item_id}/movement',
                               data=json.dumps({"type": "IN", "quantity": 15, "reason": "Llegada de lote proveedor"}),
                               content_type='application/json')
        self.assertEqual(res_in.status_code, 200)
        self.assertEqual(json.loads(res_in.data).get('data', {}).get('stock_quantity'), 35)

        # 3. Registrar Salida (OUT -10) -> nuevo stock 25
        res_out = self.app.post(f'/api/stock/{item_id}/movement',
                                data=json.dumps({"type": "OUT", "quantity": 10, "reason": "Consumo en gabinete BIA"}),
                                content_type='application/json')
        self.assertEqual(res_out.status_code, 200)
        self.assertEqual(json.loads(res_out.data).get('data', {}).get('stock_quantity'), 25)

        # 4. Registrar Ajuste (ADJUST = 8) -> nuevo stock 8
        res_adj = self.app.post(f'/api/stock/{item_id}/movement',
                                data=json.dumps({"type": "ADJUST", "quantity": 8, "reason": "Auditoría física de inventario"}),
                                content_type='application/json')
        self.assertEqual(res_adj.status_code, 200)
        self.assertEqual(json.loads(res_adj.data).get('data', {}).get('stock_quantity'), 8)

        # 5. Verificar historial de movimientos
        res_movs = self.app.get('/api/stock/movements')
        self.assertEqual(res_movs.status_code, 200)
        movs = json.loads(res_movs.data)
        item_movs = [m for m in movs if m.get('stock_item_id') == item_id or m.get('item_id') == item_id or m.get('item_name') == payload['name']]
        self.assertGreaterEqual(len(item_movs), 3)

        # Limpiar
        self.app.delete(f'/api/stock/{item_id}')

    def test_8_favicon_and_html_meta_validation(self):
        """Verifica la existencia y enlace correcto del Favicon oficial de VitaMetrix."""
        res = self.app.get('/static/favicon.svg')
        self.assertEqual(res.status_code, 200, "El favicon.svg debe estar disponible en /static/favicon.svg")
        self.assertIn("svg", res.content_type)
        self.assertIn(b"<svg", res.data)

        # Verificar que index.html contiene el link al favicon
        res_index = self.app.get('/')
        self.assertEqual(res_index.status_code, 200)
        self.assertIn(b"favicon.svg", res_index.data)

if __name__ == '__main__':
    unittest.main()
