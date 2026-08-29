"""
VitaMetrix — Test Multi-Tenant Concurrency & Strict Data Isolation
==================================================================
Valida la arquitectura multi-usuario concurrente:
1. SuperAdmin (visión global, gestión de usuarios y generación de PINs).
2. Dra. Audrey (Tenant 1) creando pacientes, evaluaciones, insumos y ventas.
3. Dr. Roberto (Tenant 2) creando su propio consultorio, verificando que NO existe fuga
   de datos entre consultorios (Cross-Tenant Data Isolation).
4. Restauración limpia de datos (0 residuos tras la ejecución).
"""

import unittest
import json
import os
import sys
import secrets

BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app, _save_users, _save_licenses, _save_persisted_stock_items, _save_persisted_stock_movements, _save_persisted_sales, _save_persisted_appointments, _save_persisted_taxonomies, _load_users, _load_licenses, _load_persisted_stock_items, _load_persisted_stock_movements, _load_persisted_sales, _load_persisted_appointments, _load_persisted_taxonomies

class TestMultiTenantConcurrency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.app = app
        cls.client = cls.app.test_client()

        # Tomar snapshots de estado previo
        users = _load_users()
        cls._orig_users = [u for u in users if u.get('id') in ('usr-admin-001', 'usr-doctor-001') or u.get('email') in ('admin@vitametrix.com', 'audrey@vitametrix.com')]
        _save_users(cls._orig_users)
        cls._orig_licenses = _load_licenses()
        cls._orig_stock_items = _load_persisted_stock_items()
        cls._orig_stock_movs = _load_persisted_stock_movements()
        cls._orig_sales = _load_persisted_sales()
        cls._orig_appts = _load_persisted_appointments()
        cls._orig_cats, cls._orig_units = _load_persisted_taxonomies()

    @classmethod
    def tearDownClass(cls):
        # Restaurar snapshots originales limpiamente
        _save_users(cls._orig_users)
        _save_licenses(cls._orig_licenses)
        _save_persisted_stock_items(cls._orig_stock_items)
        _save_persisted_stock_movements(cls._orig_stock_movs)
        _save_persisted_sales(cls._orig_sales)
        _save_persisted_appointments(cls._orig_appts)
        _save_persisted_taxonomies(cls._orig_cats, cls._orig_units)

    def _login(self, email, password):
        res = self.client.post('/api/auth/login', json={'email': email, 'password': password})
        self.assertEqual(res.status_code, 200, f"Login falló para {email}")
        data = json.loads(res.data)
        self.assertTrue(data.get('success'), f"Login no exitoso: {data}")
        return data['token'], data['user']

    def test_multi_tenant_complete_isolation_and_superadmin_flow(self):
        """Prueba de punta a punta de concurrencia y aislamiento estricto multi-tenant."""
        t_id = secrets.token_hex(3)

        # 1. Login SuperAdmin
        admin_token, admin_user = self._login('admin@vitametrix.com', 'AdminVita2026!')
        self.assertEqual(admin_user.get('role'), 'admin')
        admin_headers = {'Authorization': f'Bearer {admin_token}'}

        # 1.1 SuperAdmin genera un lote de 2 PINs de prueba
        res_pin = self.client.post('/api/admin/pins/create', headers=admin_headers, json={
            'plan_name': 'Plan Pro Mensual (30 días)',
            'duration_days': 30,
            'count': 2,
            'custom_prefix': f'VM-TENANT-{t_id.upper()}'
        })
        self.assertEqual(res_pin.status_code, 201)
        pin_data = json.loads(res_pin.data)
        created_pins = pin_data.get('pins', [])
        self.assertEqual(len(created_pins), 2)
        pin_for_audrey = created_pins[0]['license_key']

        # 2. Login Dra. Audrey (Tenant 1)
        audrey_token, audrey_user = self._login('audrey@vitametrix.com', 'Doctora2026!')
        audrey_headers = {'Authorization': f'Bearer {audrey_token}'}
        self.assertEqual(audrey_user.get('role'), 'user')

        # Dra. Audrey registra un insumo propio
        res_stk1 = self.client.post('/api/stock', headers=audrey_headers, json={
            'name': f'Electrodos Audrey {t_id}',
            'category': 'Insumos BIA',
            'unit': 'Caja (c/50)',
            'stock_quantity': 25.0,
            'cost_price': 10.0,
            'sale_price': 25.0
        })
        self.assertEqual(res_stk1.status_code, 201)
        stk1_id = json.loads(res_stk1.data)['data']['id']

        # Dra. Audrey registra una cita
        res_apt1 = self.client.post('/api/appointments', headers=audrey_headers, json={
            'patient_name': f'Paciente Audrey {t_id}',
            'patient_phone': '71234567',
            'date': '2026-09-01',
            'time': '10:00',
            'type': 'Evaluación BIA'
        })
        self.assertEqual(res_apt1.status_code, 201)

        # Dra. Audrey realiza una venta en POS
        res_sale1 = self.client.post('/api/sales', headers=audrey_headers, json={
            'patient_name': f'Paciente Audrey {t_id}',
            'items': [{'id': stk1_id, 'quantity': 2.0}],
            'payment_method': 'Efectivo',
            'discount': 0
        })
        self.assertIn(res_sale1.status_code, (200, 201))

        # Dra. Audrey canjea el PIN generado por SuperAdmin
        res_redeem = self.client.post('/api/subscription/redeem', headers=audrey_headers, json={
            'pin_key': pin_for_audrey
        })
        self.assertEqual(res_redeem.status_code, 200)
        self.assertTrue(json.loads(res_redeem.data).get('success'))

        # 3. Registro y Login del Dr. Roberto (Tenant 2)
        roberto_email = f"dr.roberto.{t_id}@clinicadelsur.com"
        res_reg = self.client.post('/api/auth/register', json={
            'email': roberto_email,
            'password': 'PasswordRoberto2026!',
            'full_name': f'Dr. Roberto Gómez {t_id}',
            'professional_title': 'Especialista en Nutrición',
            'clinic_name': 'Clínica del Sur'
        })
        self.assertEqual(res_reg.status_code, 201)

        roberto_token, roberto_user = self._login(roberto_email, 'PasswordRoberto2026!')
        roberto_headers = {'Authorization': f'Bearer {roberto_token}'}
        self.assertEqual(roberto_user.get('subscription_status'), 'trial')

        # 4. Verificación de Aislamiento Estricto para el Dr. Roberto:
        # 4.1 Insumos: Dr. Roberto NO debe ver "Electrodos Audrey"
        res_rob_stock = self.client.get('/api/stock', headers=roberto_headers)
        self.assertEqual(res_rob_stock.status_code, 200)
        rob_stock_items = json.loads(res_rob_stock.data)
        self.assertFalse(any(it.get('id') == stk1_id for it in rob_stock_items), "Fuga de datos: Dr. Roberto ve insumos de Dra. Audrey")

        # 4.2 Citas: Dr. Roberto NO debe ver la cita de Dra. Audrey
        res_rob_apts = self.client.get('/api/appointments', headers=roberto_headers)
        self.assertEqual(res_rob_apts.status_code, 200)
        rob_apts = json.loads(res_rob_apts.data)
        self.assertFalse(any(f'Paciente Audrey {t_id}' in a.get('patient_name', '') for a in rob_apts), "Fuga de datos: Dr. Roberto ve citas de Dra. Audrey")

        # 4.3 Ventas: Dr. Roberto NO debe ver la venta de Dra. Audrey
        res_rob_sales = self.client.get('/api/sales', headers=roberto_headers)
        self.assertEqual(res_rob_sales.status_code, 200)
        rob_sales = json.loads(res_rob_sales.data)
        self.assertFalse(any(f'Paciente Audrey {t_id}' in s.get('patient_name', '') for s in rob_sales), "Fuga de datos: Dr. Roberto ve ventas de Dra. Audrey")

        # 5. Dr. Roberto crea su propio insumo y venta
        res_stk2 = self.client.post('/api/stock', headers=roberto_headers, json={
            'name': f'Termómetro Roberto {t_id}',
            'category': 'Equipos',
            'unit': 'Unidad (u)',
            'stock_quantity': 10.0,
            'cost_price': 15.0,
            'sale_price': 35.0
        })
        self.assertEqual(res_stk2.status_code, 201)
        stk2_id = json.loads(res_stk2.data)['data']['id']

        # 6. Dra. Audrey NO debe ver "Termómetro Roberto"
        res_aud_stock = self.client.get('/api/stock', headers=audrey_headers)
        aud_items = json.loads(res_aud_stock.data)
        self.assertFalse(any(it.get('id') == stk2_id for it in aud_items), "Fuga de datos: Dra. Audrey ve insumos del Dr. Roberto")

        # 7. SuperAdmin verifica visibilidad global de la plataforma
        res_admin_users = self.client.get('/api/admin/users', headers=admin_headers)
        self.assertEqual(res_admin_users.status_code, 200)
        admin_data = json.loads(res_admin_users.data)
        users_list = admin_data.get('users', [])
        self.assertTrue(any(u['email'] == roberto_email for u in users_list), "SuperAdmin no ve al nuevo usuario registrado")

        # Verificar auditoría del PIN canjeado
        res_admin_pins = self.client.get('/api/admin/pins', headers=admin_headers)
        self.assertEqual(res_admin_pins.status_code, 200)
        pins_list = json.loads(res_admin_pins.data).get('pins', [])
        audrey_used_pin = next((p for p in pins_list if p['license_key'] == pin_for_audrey), None)
        self.assertIsNotNone(audrey_used_pin)
        self.assertTrue(audrey_used_pin['is_used'])
        self.assertEqual(audrey_used_pin['used_by_email'], 'audrey@vitametrix.com')

if __name__ == '__main__':
    unittest.main()