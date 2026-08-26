import unittest
import json
from backend.app import app

class TestStockAndSalesPOS(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_stock_and_sales_flow(self):
        # 1. Test Taxonomies (Opción 1: Unit creation without family)
        unit_payload = {"name": "Vial Test (v)"}
        res = self.app.post('/api/stock/taxonomies/unit', 
                            data=json.dumps(unit_payload), 
                            content_type='application/json')
        self.assertIn(res.status_code, [200, 201, 409])

        # 2. Create Stock Item
        item_payload = {
            "code": "TEST-POS-999",
            "name": "Suplemento Omega 3 Test",
            "category": "Suplementos Nutricionales",
            "unit": "Vial Test (v)",
            "stock_quantity": 20,
            "min_stock": 5,
            "cost_price": 50.0,
            "sale_price": 100.0,
            "batch_number": "LOT-2026-X",
            "expiry_date": "2027-12-31",
            "location": "Góndola A",
            "supplier": "Lab Nutri"
        }
        res = self.app.post('/api/stock',
                            data=json.dumps(item_payload),
                            content_type='application/json')
        self.assertIn(res.status_code, [200, 201])
        res_json = json.loads(res.data)
        item_id = res_json.get('data', {}).get('id') or res_json.get('id')
        self.assertIsNotNone(item_id)

        # 3. Create Sale (POS Checkout)
        sale_payload = {
            "patient_name": "Carlos Rodríguez",
            "patient_idp": "IDP-1002",
            "patient_phone": "+59170012345",
            "items": [
                {
                    "stock_item_id": item_id,
                    "quantity": 3,
                    "unit_price": 100.0
                }
            ],
            "discount": 10.0,
            "payment_method": "Efectivo",
            "amount_received": 300.0
        }
        res = self.app.post('/api/sales',
                            data=json.dumps(sale_payload),
                            content_type='application/json')
        self.assertIn(res.status_code, [200, 201])
        sale_res = json.loads(res.data)
        self.assertTrue(sale_res.get('success'))
        sale = sale_res.get('sale')
        self.assertEqual(sale['total'], 290.0)
        self.assertEqual(sale['change_given'], 10.0)
        sale_id = sale['id']

        # 4. Verify Stock was reduced from 20 to 17
        res_items = self.app.get('/api/stock')
        items = json.loads(res_items.data)
        updated_item = next((i for i in items if i['id'] == item_id), None)
        self.assertIsNotNone(updated_item)
        self.assertEqual(float(updated_item['stock_quantity']), 17.0)

        # 5. Check Sales Stats
        res_stats = self.app.get('/api/sales/stats')
        self.assertEqual(res_stats.status_code, 200)
        stats = json.loads(res_stats.data)
        self.assertGreater(stats.get('total_sales_amount', 0), 0)

        # 6. Check Kardex Movement for SALE
        res_movs = self.app.get('/api/stock/movements')
        movs = json.loads(res_movs.data)
        sale_mov = next((m for m in movs if (m.get('stock_item_id') == item_id or m.get('item_id') == item_id) and m.get('type') == 'SALE'), None)
        self.assertIsNotNone(sale_mov)
        self.assertEqual(float(sale_mov['quantity']), 3.0)

        # 7. Cancel Sale and verify stock restitution to 20
        res_cancel = self.app.delete(f'/api/sales/{sale_id}')
        self.assertEqual(res_cancel.status_code, 200)
        cancel_res = json.loads(res_cancel.data)
        self.assertTrue(cancel_res.get('success'))

        res_items2 = self.app.get('/api/stock')
        items2 = json.loads(res_items2.data)
        restored_item = next((i for i in items2 if i['id'] == item_id), None)
        self.assertEqual(float(restored_item['stock_quantity']), 20.0)

        # 8. Clean up test item and taxonomy unit
        self.app.delete(f'/api/stock/{item_id}')
        self.app.delete('/api/stock/taxonomies/unit/Vial%20Test%20(v)')

if __name__ == '__main__':
    unittest.main()
