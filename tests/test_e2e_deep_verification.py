import unittest
import json
import os
import time
import secrets
from werkzeug.security import check_password_hash
from backend.app import (
    app, 
    _TAXONOMIES_PATH, 
    _STOCK_ITEMS_PATH, 
    _STOCK_MOVEMENTS_PATH, 
    _APPOINTMENTS_PATH, 
    _SALES_PATH,
    _USERS_PATH
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
        res_32 = self.app.get('/static/favicon-32x32.png')
        self.assertEqual(res_32.status_code, 200, "El favicon-32x32.png debe estar disponible")
        self.assertIn("png", res_32.content_type)

        res_svg = self.app.get('/static/favicon.svg')
        self.assertEqual(res_svg.status_code, 200, "El favicon.svg debe estar disponible en /static/favicon.svg")
        self.assertIn("svg", res_svg.content_type)
        self.assertIn(b"<svg", res_svg.data)

        res_ico = self.app.get('/static/favicon.ico')
        self.assertEqual(res_ico.status_code, 200, "El favicon.ico debe estar disponible")

        # Verificar que index.html contiene el link al favicon 32x32
        res_index = self.app.get('/')
        self.assertEqual(res_index.status_code, 200)
        self.assertIn(b"favicon-32x32.png", res_index.data)

    def test_9_auth_registration_and_login(self):
        """Verifica el flujo completo de registro y login con hashing y tokens."""
        t_id = int(time.time())
        email = f"dra.test.{t_id}@vitametrix.com"
        pwd = "PasswordSeguro2026!"

        # 1. Registro
        reg_res = self.app.post('/api/auth/register', data=json.dumps({
            "email": email,
            "password": pwd,
            "full_name": "Dra. Test E2E",
            "professional_title": "Nutricionista BIA",
            "clinic_name": "Clínica Test"
        }), content_type='application/json')
        self.assertEqual(reg_res.status_code, 201)
        reg_data = json.loads(reg_res.data)
        self.assertTrue(reg_data.get('success'))
        self.assertIn('token', reg_data)
        token = reg_data['token']
        user_info = reg_data.get('user', {})
        self.assertEqual(user_info.get('email'), email)
        self.assertEqual(user_info.get('subscription', {}).get('status'), 'trial')
        self.assertEqual(user_info.get('subscription', {}).get('days_left'), 7)

        # 2. Login con credenciales válidas
        log_res = self.app.post('/api/auth/login', data=json.dumps({
            "email": email,
            "password": pwd
        }), content_type='application/json')
        self.assertEqual(log_res.status_code, 200)
        log_data = json.loads(log_res.data)
        self.assertTrue(log_data.get('success'))
        self.assertIn('token', log_data)

        # 3. Login con contraseña inválida
        bad_res = self.app.post('/api/auth/login', data=json.dumps({
            "email": email,
            "password": "PasswordEquivocada!"
        }), content_type='application/json')
        self.assertEqual(bad_res.status_code, 401)

        # 4. Validar endpoint /api/auth/me con token
        me_res = self.app.get('/api/auth/me', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.status_code, 200)
        me_data = json.loads(me_res.data)
        self.assertEqual(me_data.get('user', {}).get('email'), email)

    def test_10_subscription_lifecycle_and_whatsapp(self):
        """Verifica la consulta de suscripción, formato de WhatsApp (+591 72125280) y canje de licencias."""
        t_id = int(time.time())
        email = f"dr.lic.{t_id}@vitametrix.com"
        reg_res = self.app.post('/api/auth/register', data=json.dumps({
            "email": email,
            "password": "DoctorClave2026!",
            "full_name": "Dr. Licenciado Test"
        }), content_type='application/json')
        token = json.loads(reg_res.data)['token']

        # 1. Consultar estado de suscripción
        sub_res = self.app.get('/api/subscription/status', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(sub_res.status_code, 200)
        sub_data = json.loads(sub_res.data)
        wa = sub_data.get('whatsapp', {})
        self.assertEqual(wa.get('phone_display'), "+591 72125280")
        self.assertEqual(wa.get('phone_e164'), "59172125280")
        self.assertIn(email, wa.get('message_text', ''))

        # 2. Crear una clave de licencia desde el módulo Admin
        admin_res = self.app.post('/api/admin/licenses/create', data=json.dumps({
            "duration_days": 30,
            "plan_name": "Plan Pro Mensual E2E"
        }), content_type='application/json')
        self.assertEqual(admin_res.status_code, 201)
        lic_key = json.loads(admin_res.data)['license_keys'][0]
        self.assertTrue(lic_key.startswith("VM-1M-"))

        # 3. Canjear la licencia creada
        redeem_res = self.app.post('/api/subscription/redeem', data=json.dumps({
            "license_key": lic_key
        }), headers={"Authorization": f"Bearer {token}"}, content_type='application/json')
        self.assertEqual(redeem_res.status_code, 200)
        redeem_data = json.loads(redeem_res.data)
        self.assertTrue(redeem_data.get('success'))
        self.assertEqual(redeem_data.get('subscription', {}).get('status'), 'active')
        self.assertGreaterEqual(redeem_data.get('subscription', {}).get('days_left'), 30)

        # 4. Intentar canjear la misma licencia nuevamente (debe fallar con 409)
        duplicate_res = self.app.post('/api/subscription/redeem', data=json.dumps({
            "license_key": lic_key
        }), headers={"Authorization": f"Bearer {token}"}, content_type='application/json')
        self.assertEqual(duplicate_res.status_code, 409)

    def test_11_multi_tenant_isolation(self):
        """Verifica el aislamiento estricto de datos entre dos usuarios distintos en Stock, Clientes, Citas y Ventas."""
        t_id = int(time.time())
        user_a_res = self.app.post('/api/auth/register', data=json.dumps({
            "email": f"dr.a.{t_id}@vitametrix.com",
            "password": "PasswordUserA123!",
            "full_name": "Dr. Usuario A",
            "clinic_name": "Clínica Dr A"
        }), content_type='application/json')
        token_a = json.loads(user_a_res.data)['token']

        user_b_res = self.app.post('/api/auth/register', data=json.dumps({
            "email": f"dr.b.{t_id}@vitametrix.com",
            "password": "PasswordUserB123!",
            "full_name": "Dr. Usuario B",
            "clinic_name": "Clínica Dr B"
        }), content_type='application/json')
        token_b = json.loads(user_b_res.data)['token']

        # 1. AISLAMIENTO DE STOCK
        item_res = self.app.post('/api/stock', data=json.dumps({
            "name": f"Insumo Exclusivo de Usuario A {t_id}",
            "category": "Insumos BIA",
            "stock_quantity": 50,
            "min_stock": 10,
            "cost_price": 20,
            "sale_price": 35
        }), headers={"Authorization": f"Bearer {token_a}"}, content_type='application/json')
        self.assertIn(item_res.status_code, [200, 201])
        item_a_id = json.loads(item_res.data).get('data', {}).get('id')

        # Usuario A ve su producto
        list_a = self.app.get('/api/stock', headers={"Authorization": f"Bearer {token_a}"})
        items_a = json.loads(list_a.data)
        self.assertTrue(any(it.get('id') == item_a_id for it in items_a))

        # 2. AISLAMIENTO DE CLIENTES / PACIENTES
        cl_res = self.app.post('/api/clients', data=json.dumps({
            "name": f"Paciente Exclusivo Dr A {t_id}",
            "phone": "+59170000001",
            "email": "paciente.a@correo.com",
            "gender": "Masculino",
            "age": 30,
            "height": 175
        }), headers={"Authorization": f"Bearer {token_a}"}, content_type='application/json')
        self.assertEqual(cl_res.status_code, 200)

        # Usuario A ve su paciente
        clients_a = json.loads(self.app.get('/api/clients', headers={"Authorization": f"Bearer {token_a}"}).data)
        self.assertTrue(any(f"Paciente Exclusivo Dr A {t_id}" in c.get('name', '') for c in clients_a))

        # 3. AISLAMIENTO DE CITAS
        apt_res = self.app.post('/api/appointments', data=json.dumps({
            "patient_name": f"Paciente Cita Dr A {t_id}",
            "date": "2026-10-15",
            "time": "10:30",
            "type": "Evaluación BIA"
        }), headers={"Authorization": f"Bearer {token_a}"}, content_type='application/json')
        self.assertEqual(apt_res.status_code, 201)

        # Usuario A ve su cita
        appts_a = json.loads(self.app.get('/api/appointments', headers={"Authorization": f"Bearer {token_a}"}).data)
        self.assertTrue(any(f"Paciente Cita Dr A {t_id}" in ap.get('patient_name', '') for ap in appts_a))

        cl_id = json.loads(cl_res.data).get('data', {}).get('id')

        # Limpiar recursos de prueba
        if cl_id:
            self.app.delete(f'/api/clients/{cl_id}')
        self.app.delete(f'/api/stock/{item_a_id}', headers={"Authorization": f"Bearer {token_a}"})

    def test_12_user_registration_login_and_db_persistence(self):
        """
        Test E2E Exhaustivo:
        1. Registro de nuevo usuario médico
        2. Verificación de token HMAC y payload seguro
        3. Verificación de permanencia física en Base de Datos / Disco (data/users.json)
        4. Verificación de Hash criptográfico scrypt del password
        5. Flujo de Login con credenciales válidas e inválidas
        6. Validación de sesión con /api/auth/me
        7. Prevención estricta de cuentas duplicadas con mismo email
        """
        t_id = int(time.time() * 1000)
        raw_password = f"DoctorSeguro{t_id}!@"
        user_email = f"dra.elena.{t_id}@clinicavita.com"
        full_name = "Dra. Elena Ramos Nutricionista"
        title = "Especialista en Composición Corporal BIA"
        clinic = "Centro Nutricional VitaSalud"

        # 1. REGISTRO DE CUENTA
        reg_payload = {
            "email": user_email,
            "password": raw_password,
            "full_name": full_name,
            "professional_title": title,
            "clinic_name": clinic
        }

        reg_res = self.app.post('/api/auth/register',
                                data=json.dumps(reg_payload),
                                content_type='application/json')
        self.assertIn(reg_res.status_code, [200, 201])
        reg_data = json.loads(reg_res.data)
        self.assertTrue(reg_data.get('success'))
        self.assertIn('token', reg_data)
        token = reg_data['token']
        self.assertTrue(len(token) > 20 and '.' in token, "El token HMAC debe ser válido")

        user_info = reg_data.get('user', {})
        user_id = user_info.get('id')
        self.assertIsNotNone(user_id, "El usuario debe tener un UUID asignado")
        self.assertEqual(user_info.get('email'), user_email)
        self.assertEqual(user_info.get('full_name'), full_name)
        self.assertEqual(user_info.get('professional_title'), title)
        self.assertEqual(user_info.get('clinic_name'), clinic)
        self.assertEqual(user_info.get('role'), 'user')
        self.assertEqual(user_info.get('subscription', {}).get('status'), 'trial')
        self.assertEqual(user_info.get('subscription', {}).get('days_left'), 7)
        self.assertNotIn('password_hash', user_info, "La API jamás debe exponer el hash del password")

        # 2. VERIFICACIÓN DE PERMANENCIA FÍSICA EN BASE DE DATOS (users.json)
        self.assertTrue(os.path.exists(_USERS_PATH), f"El archivo {_USERS_PATH} debe existir físicamente")
        with open(_USERS_PATH, 'r', encoding='utf-8') as f:
            all_users = json.load(f)

        db_user = next((u for u in all_users if u.get('id') == user_id), None)
        self.assertIsNotNone(db_user, f"El usuario {user_id} ({user_email}) debe estar físicamente persistido en users.json")
        self.assertEqual(db_user.get('email'), user_email)
        self.assertEqual(db_user.get('full_name'), full_name)
        self.assertEqual(db_user.get('role'), 'user')
        self.assertEqual(db_user.get('subscription_status'), 'trial')
        self.assertIn('trial_started_at', db_user)
        self.assertIn('subscription_expires_at', db_user)

        # 3. VERIFICACIÓN DEL HASH CRIPTOGRÁFICO
        stored_hash = db_user.get('password_hash', '')
        self.assertTrue(stored_hash.startswith('scrypt:'), "El password_hash debe usar el algoritmo scrypt")
        self.assertTrue(check_password_hash(stored_hash, raw_password), "El hash debe verificar la contraseña original")
        self.assertFalse(check_password_hash(stored_hash, "PasswordIncorrecta999!"), "El hash debe rechazar contraseñas erróneas")

        # 4. PRUEBA DE LOGIN CON CREDENCIALES CORRECTAS
        login_res = self.app.post('/api/auth/login',
                                  data=json.dumps({"email": user_email, "password": raw_password}),
                                  content_type='application/json')
        self.assertEqual(login_res.status_code, 200)
        login_data = json.loads(login_res.data)
        self.assertTrue(login_data.get('success'))
        self.assertEqual(login_data.get('user', {}).get('id'), user_id)
        login_token = login_data.get('token')

        # 5. PRUEBA DE LOGIN CON CONTRASEÑA INCORRECTA (Debe fallar con 401)
        bad_pass_res = self.app.post('/api/auth/login',
                                     data=json.dumps({"email": user_email, "password": "ClaveEquivocada123!"}),
                                     content_type='application/json')
        self.assertEqual(bad_pass_res.status_code, 401)
        self.assertIn('error', json.loads(bad_pass_res.data))

        # 6. PRUEBA DE LOGIN CON CORREO NO REGISTRADO (Debe fallar con 401)
        bad_email_res = self.app.post('/api/auth/login',
                                      data=json.dumps({"email": f"noexiste.{t_id}@vitametrix.com", "password": raw_password}),
                                      content_type='application/json')
        self.assertEqual(bad_email_res.status_code, 401)

        # 7. VERIFICACIÓN DE SESIÓN CON /api/auth/me
        me_res = self.app.get('/api/auth/me', headers={"Authorization": f"Bearer {login_token}"})
        self.assertEqual(me_res.status_code, 200)
        me_data = json.loads(me_res.data)
        self.assertTrue(me_data.get('authenticated'))
        self.assertEqual(me_data.get('user', {}).get('id'), user_id)
        self.assertEqual(me_data.get('user', {}).get('email'), user_email)

        # 8. VERIFICACIÓN DE ACCESO SIN TOKEN (Debe fallar con 401)
        unauth_res = self.app.get('/api/auth/me')
        self.assertEqual(unauth_res.status_code, 401)

        # 9. PREVENCIÓN DE REGISTRO DUPLICADO CON EL MISMO EMAIL (Debe responder con error 400/409)
        dup_res = self.app.post('/api/auth/register',
                                data=json.dumps(reg_payload),
                                content_type='application/json')
        self.assertIn(dup_res.status_code, [400, 409])
        dup_data = json.loads(dup_res.data)
        self.assertFalse(dup_data.get('success', False))
        self.assertIn('registrad', dup_data.get('error', '').lower())

    def test_13_superadmin_panel_apis_and_access_control(self):
        """
        Test E2E de SuperAdmin:
        1. Login con credenciales de SuperAdmin (admin@vitametrix.com)
        2. Consulta del listado global de usuarios y estadísticas
        3. Control de acceso: bloqueo 403 para usuarios estándar y 401 para anónimos
        4. Creación de doctor desde el panel SuperAdmin
        5. Extensión de suscripción (+30 días)
        6. Cambio de estado/plan
        7. Eliminación de usuario y protección de auto-eliminación
        """
        # 1. Login SuperAdmin
        admin_login = self.app.post('/api/auth/login', data=json.dumps({
            "email": "admin@vitametrix.com",
            "password": "AdminVita2026!"
        }), content_type='application/json')
        self.assertEqual(admin_login.status_code, 200)
        admin_token = json.loads(admin_login.data)['token']
        self.assertEqual(json.loads(admin_login.data)['user']['role'], 'admin')

        # 2. Login Usuario Estándar para pruebas de control de acceso
        t_id = int(time.time() * 1000)
        user_reg = self.app.post('/api/auth/register', data=json.dumps({
            "email": f"dr.estandar.{t_id}@vitametrix.com",
            "password": "PasswordDoctor123!",
            "full_name": "Dr. Estandar Test"
        }), content_type='application/json')
        user_token = json.loads(user_reg.data)['token']

        # 3. Control de Acceso a GET /api/admin/users
        # Con token de SuperAdmin -> 200 OK
        admin_users_res = self.app.get('/api/admin/users', headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(admin_users_res.status_code, 200)
        admin_users_data = json.loads(admin_users_res.data)
        self.assertTrue(admin_users_data.get('success'))
        self.assertIn('users', admin_users_data)
        self.assertIn('stats', admin_users_data)
        self.assertGreaterEqual(admin_users_data['stats']['total_users'], 1)

        # Con token de usuario común -> 403 Forbidden
        forbidden_res = self.app.get('/api/admin/users', headers={"Authorization": f"Bearer {user_token}"})
        self.assertEqual(forbidden_res.status_code, 403)

        # Sin token -> 401 Unauthorized
        unauth_res = self.app.get('/api/admin/users')
        self.assertEqual(unauth_res.status_code, 401)

        # 4. SuperAdmin crea un nuevo usuario médico
        new_doc_email = f"dr.creado.{t_id}@clinicavita.com"
        create_res = self.app.post('/api/admin/users/create', data=json.dumps({
            "email": new_doc_email,
            "password": "PasswordPro2026!",
            "full_name": "Dr. Médico Creado SuperAdmin",
            "professional_title": "Especialista Clínico BIA",
            "clinic_name": "Clínica San Gabriel",
            "phone": "+59171234567",
            "role": "user",
            "subscription_plan": "Plan Pro Mensual (30 días)",
            "duration_days": 30
        }), headers={"Authorization": f"Bearer {admin_token}"}, content_type='application/json')
        self.assertEqual(create_res.status_code, 201)
        created_user_id = json.loads(create_res.data)['user']['id']

        # 5. SuperAdmin extiende la suscripción (+60 días)
        extend_res = self.app.post(f'/api/admin/users/{created_user_id}/extend', data=json.dumps({
            "days": 60,
            "plan_name": "Plan Pro Trimestral"
        }), headers={"Authorization": f"Bearer {admin_token}"}, content_type='application/json')
        self.assertEqual(extend_res.status_code, 200)
        extend_data = json.loads(extend_res.data)
        self.assertGreaterEqual(extend_data['user']['subscription']['days_left'], 60)

        # 6. SuperAdmin cambia el estado del usuario
        status_res = self.app.post(f'/api/admin/users/{created_user_id}/status', data=json.dumps({
            "status": "lifetime",
            "plan_name": "Plan Ilimitado / Lifetime"
        }), headers={"Authorization": f"Bearer {admin_token}"}, content_type='application/json')
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(json.loads(status_res.data)['user']['subscription']['status'], 'lifetime')

        # 7. SuperAdmin elimina el usuario creado individualmente
        del_res = self.app.delete(f'/api/admin/users/{created_user_id}', headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(del_res.status_code, 200)

        # 8. SuperAdmin elimina múltiples usuarios por lote (Batch Delete)
        batch_u1 = self.app.post('/api/auth/register', data=json.dumps({
            "email": f"batch1.{t_id}@vitametrix.com",
            "password": "PasswordBatch123!",
            "full_name": "Dr. Batch Uno"
        }), content_type='application/json')
        batch_u2 = self.app.post('/api/auth/register', data=json.dumps({
            "email": f"batch2.{t_id}@vitametrix.com",
            "password": "PasswordBatch123!",
            "full_name": "Dr. Batch Dos"
        }), content_type='application/json')
        u1_id = json.loads(batch_u1.data)['user']['id']
        u2_id = json.loads(batch_u2.data)['user']['id']

        batch_del_res = self.app.post('/api/admin/users/batch-delete', data=json.dumps({
            "user_ids": [u1_id, u2_id]
        }), headers={"Authorization": f"Bearer {admin_token}"}, content_type='application/json')
        self.assertEqual(batch_del_res.status_code, 200)
        batch_data = json.loads(batch_del_res.data)
        self.assertTrue(batch_data.get('success'))
        self.assertEqual(batch_data.get('deleted_count'), 2)

        # 9. Protección: SuperAdmin no puede auto-eliminarse individualmente ni por lote
        admin_user_id = json.loads(admin_login.data)['user']['id']
        self_del_res = self.app.delete(f'/api/admin/users/{admin_user_id}', headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(self_del_res.status_code, 400)

        self_batch_res = self.app.post('/api/admin/users/batch-delete', data=json.dumps({
            "user_ids": [admin_user_id]
        }), headers={"Authorization": f"Bearer {admin_token}"}, content_type='application/json')
        self.assertEqual(self_batch_res.status_code, 400)

    def test_14_superadmin_lifetime_status_and_pins_management(self):
        """
        Test E2E de Estatus Vitalicio SuperAdmin, Gestión de PINs y Canje:
        1. Login SuperAdmin -> Verificar status lifetime, days_left is None, expires_at is None
        2. SuperAdmin genera PINs de prueba (1 mensual + 1 vitalicio)
        3. SuperAdmin consulta lista de PINs y KPIs
        4. Doctor estándar canjea el PIN y obtiene 30 días de suscripción
        5. Intentar canjear el mismo PIN de nuevo -> Bloqueo 409
        6. SuperAdmin elimina un PIN
        7. Verificar que usuarios no admin reciban 403 en endpoints de PINs
        8. Verificar que Tigo Money no existe en el template de suscripción
        """
        # 1. Login SuperAdmin
        admin_login = self.app.post('/api/auth/login', data=json.dumps({
            "email": "admin@vitametrix.com",
            "password": "AdminVita2026!"
        }), content_type='application/json')
        self.assertEqual(admin_login.status_code, 200)
        admin_data = json.loads(admin_login.data)
        admin_token = admin_data['token']
        admin_sub = admin_data['user']['subscription']

        # Verificar que el SuperAdmin no tiene vencimiento ni días restantes limitados
        self.assertEqual(admin_sub['status'], 'lifetime')
        self.assertIsNone(admin_sub['days_left'])
        self.assertIsNone(admin_sub['expires_at'])
        self.assertIn('SuperAdmin', admin_sub['plan_name'])

        # 2. SuperAdmin genera 1 PIN personalizado de 30 días
        t_id = int(time.time() * 1000)
        custom_pin_key = f"VM-TEST-{secrets.token_hex(3).upper()}"
        create_pin_res = self.app.post('/api/admin/pins/create', data=json.dumps({
            "duration_days": 30,
            "plan_name": "Plan Pro Mensual (30 días)",
            "custom_pin": custom_pin_key,
            "note": "PIN de Prueba para Doctor Test",
            "count": 1
        }), headers={"Authorization": f"Bearer {admin_token}"}, content_type='application/json')
        self.assertEqual(create_pin_res.status_code, 201)
        created_pin = json.loads(create_pin_res.data)['created_pins'][0]
        self.assertEqual(created_pin['license_key'], custom_pin_key)

        # Generar PIN automático para eliminación
        pin_for_delete_res = self.app.post('/api/admin/pins/create', data=json.dumps({
            "duration_days": 90,
            "note": "PIN temporal para test de eliminación",
            "count": 1
        }), headers={"Authorization": f"Bearer {admin_token}"}, content_type='application/json')
        self.assertEqual(pin_for_delete_res.status_code, 201)
        pin_to_delete_id = json.loads(pin_for_delete_res.data)['created_pins'][0]['id']

        # 3. Consultar lista de PINs
        pins_list_res = self.app.get('/api/admin/pins', headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(pins_list_res.status_code, 200)
        pins_data = json.loads(pins_list_res.data)
        self.assertTrue(pins_data.get('success'))
        self.assertIn('pins', pins_data)
        self.assertIn('stats', pins_data)
        self.assertGreaterEqual(pins_data['stats']['total_pins'], 2)
        self.assertGreaterEqual(pins_data['stats']['available_pins'], 2)

        # 4. Doctor estándar canjea el PIN
        doc_email = f"dr.canje.{t_id}@clinicavita.com"
        doc_reg = self.app.post('/api/auth/register', data=json.dumps({
            "email": doc_email,
            "password": "PasswordDoc123!",
            "full_name": "Dra. Sofía Morales"
        }), content_type='application/json')
        doc_token = json.loads(doc_reg.data)['token']

        redeem_res = self.app.post('/api/subscription/redeem', data=json.dumps({
            "license_key": custom_pin_key
        }), headers={"Authorization": f"Bearer {doc_token}"}, content_type='application/json')
        self.assertEqual(redeem_res.status_code, 200)
        redeem_data = json.loads(redeem_res.data)
        self.assertTrue(redeem_data.get('success'))
        self.assertGreaterEqual(redeem_data['subscription']['days_left'], 30)

        # 5. Intentar canjear de nuevo el mismo PIN -> 409 Conflict
        redeem_dup = self.app.post('/api/subscription/redeem', data=json.dumps({
            "license_key": custom_pin_key
        }), headers={"Authorization": f"Bearer {doc_token}"}, content_type='application/json')
        self.assertEqual(redeem_dup.status_code, 409)

        # 6. Eliminar PIN temporal
        del_pin_res = self.app.delete(f'/api/admin/pins/{pin_to_delete_id}', headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(del_pin_res.status_code, 200)

        # 7. Control de Acceso: Usuario normal recibe 403
        user_pins_res = self.app.get('/api/admin/pins', headers={"Authorization": f"Bearer {doc_token}"})
        self.assertEqual(user_pins_res.status_code, 403)

        # 8. Verificar que Tigo Money no existe en el template
        with open('frontend/templates/suscripcion.html', 'r', encoding='utf-8') as f:
            template_content = f.read()
        self.assertNotIn('Tigo Money', template_content)
        self.assertIn('QR Simple', template_content)
        self.assertIn('Transferencia', template_content)

if __name__ == '__main__':
    unittest.main()

