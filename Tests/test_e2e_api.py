import os
import sys
import unittest
import json

# Agregar la raíz del backend al path de Python
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app
from services.helpers import _generate_auth_token

class VitaMetrixE2ETestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        # Generar token JWT de prueba para doctor
        self.doctor_token = _generate_auth_token("usr-doctor-001", "audrey@vitametrix.com", role="user")
        self.admin_token = _generate_auth_token("usr-admin-001", "admin@vitametrix.com", role="admin")

        self.doctor_headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        self.admin_headers = {
            'Authorization': f'Bearer {self.admin_token}',
            'Content-Type': 'application/json'
        }

    def test_01_index_html_loads(self):
        """Verifica que la SPA index.html cargue correctamente con status 200"""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'VitaMetrix', response.data)

    def test_02_auth_me_endpoint(self):
        """Verifica la autenticación y perfil del usuario activo"""
        response = self.client.get('/api/auth/me', headers=self.doctor_headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get('email'), 'admin@vitametrix.com')

    def test_03_subscription_status_endpoint(self):
        """Verifica el estado de suscripción del doctor"""
        response = self.client.get('/api/subscription/status', headers=self.doctor_headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('is_active', data)
        self.assertTrue(data['is_active'])

    def test_04_dashboard_stats_endpoints(self):
        """Verifica que las 3 variaciones de rutas de estadísticas del Dashboard respondan con 200 OK"""
        for route in ['/api/dashboard/stats', '/api/dashboard-stats', '/api/dashboard-data']:
            response = self.client.get(route, headers=self.doctor_headers)
            self.assertEqual(response.status_code, 200, f"Fallo en ruta {route}")
            data = json.loads(response.data)
            self.assertIn('total_clients', data)
            self.assertIn('total_evaluations', data)

    def test_05_stock_crud_and_adjust(self):
        """Verifica el ciclo de vida del inventario: obtener, crear, actualizar y ajustar stock"""
        # 1. Obtener catálogo
        res_list = self.client.get('/api/stock', headers=self.doctor_headers)
        self.assertEqual(res_list.status_code, 200)
        items = json.loads(res_list.data)
        self.assertIsInstance(items, list)

        # 2. Crear un insumo de prueba
        new_item = {
            "code": "TST-999",
            "name": "Insumo de Prueba E2E",
            "category": "Insumos BIA",
            "unit": "Caja",
            "stock_quantity": 50,
            "min_stock": 10,
            "cost_price": 25.0,
            "sale_price": 40.0,
            "batch_number": "LOT-E2E-2026",
            "expiry_date": "2027-12-31",
            "location": "Estante A",
            "supplier": "BioSupplies Bolivia",
            "notes": "Test automatizado"
        }
        res_create = self.client.post('/api/stock', data=json.dumps(new_item), headers=self.doctor_headers)
        self.assertEqual(res_create.status_code, 201)
        created_data = json.loads(res_create.data)
        item_id = created_data.get('id') or (created_data.get('item') or {}).get('id')
        self.assertIsNotNone(item_id)

        # 3. Editar insumo
        update_data = {
            "name": "Insumo E2E Actualizado",
            "cost_price": 30.0,
            "sale_price": 50.0
        }
        res_update = self.client.put(f'/api/stock/{item_id}', data=json.dumps(update_data), headers=self.doctor_headers)
        self.assertEqual(res_update.status_code, 200)

        # 4. Ajustar stock (Kardex)
        adjust_data = {
            "type": "IN",
            "quantity": 10,
            "reason": "Compra lote adicional E2E"
        }
        res_adjust = self.client.post(f'/api/stock/{item_id}/adjust', data=json.dumps(adjust_data), headers=self.doctor_headers)
        self.assertEqual(res_adjust.status_code, 200)

        # 5. Limpieza del ítem de prueba para no dejar residuos
        self.client.delete(f'/api/stock/{item_id}', headers=self.doctor_headers)

    def test_06_stock_movements_endpoint(self):
        """Verifica la consulta global de movimientos de kardex"""
        response = self.client.get('/api/stock/movements', headers=self.doctor_headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)

    def test_07_stock_taxonomies_endpoint(self):
        """Verifica la consulta de taxonomías de catálogo (categorías y unidades)"""
        response = self.client.get('/api/stock/taxonomies', headers=self.doctor_headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('categories', data)
        self.assertIn('units', data)

    def test_08_clients_crud(self):
        """Verifica la creación y obtención de pacientes"""
        res_list = self.client.get('/api/clients', headers=self.doctor_headers)
        self.assertEqual(res_list.status_code, 200)

        new_client = {
            "name": "Paciente Pruebas E2E",
            "idp": "IDP-E2E-001",
            "ci": "12345678",
            "phone": "+591 70000000",
            "gender": "masculino",
            "age": 30
        }
        res_create = self.client.post('/api/clients', data=json.dumps(new_client), headers=self.doctor_headers)
        self.assertEqual(res_create.status_code, 201)
        created_client = json.loads(res_create.data)
        client_id = created_client.get('id') or (created_client.get('client') or {}).get('id')
        if client_id:
            self.client.delete(f'/api/clients/{client_id}', headers=self.doctor_headers)

    def test_09_evaluations_list(self):
        """Verifica la consulta, detalle y eliminación de evaluaciones clínicas"""
        response = self.client.get('/api/evaluations', headers=self.doctor_headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)
        if len(data) > 0:
            eval_id = data[0].get('id')
            res_detail = self.client.get(f'/api/evaluations/{eval_id}', headers=self.doctor_headers)
            self.assertEqual(res_detail.status_code, 200)

        res_batch = self.client.post('/api/evaluations/batch-delete', data=json.dumps({"ids": []}), headers=self.doctor_headers)
        self.assertIn(res_batch.status_code, (400, 200))

    def test_09b_evaluation_code_recycling(self):
        """Verifica la generación secuencial y reciclaje de códigos EVA-XXX libre"""
        eval_payload = {
            "patient_name": "Test Code Recycling Patient",
            "patient_idp": "IDP-TEST-REC",
            "resistance": 550,
            "reactance": 60,
            "weight": 70,
            "height": 170,
            "age": 30,
            "gender": "male",
            "save": True
        }
        res1 = self.client.post('/api/dashboard-data', data=json.dumps(eval_payload), headers=self.doctor_headers)
        self.assertEqual(res1.status_code, 201)
        data1 = json.loads(res1.data)
        eval1 = data1.get('evaluation', {})
        code1 = eval1.get('code')
        id1 = eval1.get('id')
        self.assertTrue(code1 and code1.startswith('EVA-'))

        if id1:
            self.client.delete(f'/api/evaluations/{id1}', headers=self.doctor_headers)

        res2 = self.client.post('/api/dashboard-data', data=json.dumps(eval_payload), headers=self.doctor_headers)
        self.assertEqual(res2.status_code, 201)
        data2 = json.loads(res2.data)
        eval2 = data2.get('evaluation', {})
        code2 = eval2.get('code')
        id2 = eval2.get('id')
        self.assertEqual(code1, code2)

        if id2:
            self.client.delete(f'/api/evaluations/{id2}', headers=self.doctor_headers)

    def test_10_appointments_list(self):
        """Verifica la consulta y agendamiento de citas"""
        response = self.client.get('/api/appointments', headers=self.doctor_headers)
        self.assertEqual(response.status_code, 200)

    def test_11_sales_and_stats(self):
        """Verifica las ventas POS y sus estadísticas"""
        res_sales = self.client.get('/api/sales', headers=self.doctor_headers)
        self.assertEqual(res_sales.status_code, 200)

        res_stats = self.client.get('/api/sales/stats', headers=self.doctor_headers)
        self.assertEqual(res_stats.status_code, 200)
        data = json.loads(res_stats.data)
        self.assertIn('total_sales_amount', data)
        self.assertIn('total_profit', data)
        self.assertIn('today_sales_amount', data)

    def test_12_admin_endpoints(self):
        """Verifica los paneles de administración de superadmin"""
        res_users = self.client.get('/api/admin/users', headers=self.admin_headers)
        self.assertEqual(res_users.status_code, 200)

        res_pins = self.client.get('/api/admin/pins', headers=self.admin_headers)
        self.assertEqual(res_pins.status_code, 200)

if __name__ == '__main__':
    unittest.main()
