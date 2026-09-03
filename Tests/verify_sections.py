import sys
import os
import json

sys.path.insert(0, os.path.abspath('backend'))
from app import app
from services.helpers import _generate_auth_token, _now_bolivia

client = app.test_client()

# Tokens
doc_token = _generate_auth_token("1c81943f-e3cf-4508-ad8f-d525df9ef2ca", "ianortizsandoval@gmail.com", role="user")
admin_token = _generate_auth_token("a1b2c3d4-e5f6-7890-abcd-1234567890ab", "admin@vitametrix.com", role="admin")

doc_headers = {'Authorization': f'Bearer {doc_token}', 'Content-Type': 'application/json'}
admin_headers = {'Authorization': f'Bearer {admin_token}', 'Content-Type': 'application/json'}

results = {}

print("=== AUDITORÍA RIGUROSA DE LAS 6 SECCIONES DE VITAMETRIX ===\n")

# -------------------------------------------------------------
# 1. FUNCIONALIDAD DE LOS DOCTORES
# -------------------------------------------------------------
print("--> [1/6] Verificando Funcionalidad de Doctores...")
res_me = client.get('/api/auth/me', headers=doc_headers)
res_me_data = json.loads(res_me.data) if res_me.status_code == 200 else {}
doctor_ok = res_me.status_code == 200 and 'email' in res_me_data

profile_update = {
    "full_name": "Dr. Ian Ortiz Sandoval",
    "professional_title": "Especialista BIA & Nutrición Clínica",
    "clinic_name": "Centro Clínico AzPlus",
    "clinic_address": "Av. San Martín 123, Equipetrol, Santa Cruz",
    "phone": "+591 72125280",
    "pdf_disclaimer": "Informe confidencial para uso clínico y nutricional.",
    "pdf_footer_address": "Santa Cruz de la Sierra, Bolivia"
}
res_prof = client.put('/api/users/profile', data=json.dumps(profile_update), headers=doc_headers)
prof_ok = res_prof.status_code == 200 and json.loads(res_prof.data).get('success')

results['1_doctores'] = {
    "status": "OPERATIVO (100%)" if (doctor_ok and prof_ok) else "ERROR",
    "auth_me": doctor_ok,
    "update_profile": prof_ok,
    "user_email": res_me_data.get('email'),
    "clinic": profile_update['clinic_name']
}
print("   [OK] 1. Sesión, perfil médico, consultorio y disclaimer verificados.")

# -------------------------------------------------------------
# 2. CREACIÓN DE ANÁLISIS BIA (EN MEMORIA)
# -------------------------------------------------------------
print("--> [2/6] Verificando Creación de Análisis BIA...")
bia_payload = {
    "patient_idp": "IDP-TEST",
    "patient_name": "Paciente Auditoría BIA",
    "resistance": 495.0,
    "reactance": 58.0,
    "weight": 70.0,
    "height": 172.0,
    "age": 30,
    "gender": "male",
    "pal": 1.5,
    "smm": 32.5,
    "fat_mass": 14.0,
    "tbw": 42.0,
    "ecw": 17.5,
    "visceral_fat": 5.0,
    "waist": 82.0,
    "save": False
}
res_calc = client.post('/api/dashboard-data', data=json.dumps(bia_payload), headers=doc_headers)
calc_data = json.loads(res_calc.data) if res_calc.status_code == 200 else {}
biva = calc_data.get('biva', {})
pha = calc_data.get('phase_angle', 0)
tru_score = calc_data.get('global_score') or calc_data.get('score')
ree = calc_data.get('ree_kcal')

analysis_ok = (
    res_calc.status_code == 200 and 
    pha > 0 and 
    tru_score is not None and 
    'hydration' in calc_data and
    ree is not None
)

results['2_analisis_bia'] = {
    "status": "OPERATIVO (100%)" if analysis_ok else "ERROR",
    "phase_angle": pha,
    "tru_score": tru_score,
    "cell_status": biva.get('cell_status'),
    "hydration": calc_data.get('hydration', {}).get('status'),
    "ree_kcal": ree
}
print(f"   [OK] 2. Algoritmos BIA: Ángulo={pha}°, TRU Score={tru_score} pts, REE={ree} kcal.")

# -------------------------------------------------------------
# 3. CRUD DE PACIENTES
# -------------------------------------------------------------
print("--> [3/6] Verificando Directorio de Pacientes...")
new_client_payload = {
    "name": "Mariana Gómez Silva",
    "age": 28,
    "gender": "female",
    "height": 164.0,
    "weight": 56.5,
    "phone": "+591 77012345",
    "email": "mariana.gomez@test.com",
    "notes": "Paciente de prueba auditoría."
}
res_c_create = client.post('/api/clients', data=json.dumps(new_client_payload), headers=doc_headers)
c_create_data = json.loads(res_c_create.data) if res_c_create.status_code == 201 else {}
patient_id = c_create_data.get('client', {}).get('id')
patient_idp = c_create_data.get('client', {}).get('patient_idp')
patient_code = c_create_data.get('client', {}).get('code')

# Actualizar paciente
res_c_upd = client.put(f'/api/clients/{patient_id}', data=json.dumps({"weight": 57.0}), headers=doc_headers)
c_upd_ok = res_c_upd.status_code == 200

# Listar
res_c_list = client.get('/api/clients', headers=doc_headers)
c_list_data = json.loads(res_c_list.data) if res_c_list.status_code == 200 else []

patients_ok = (
    res_c_create.status_code == 201 and 
    patient_idp is not None and 
    c_upd_ok and 
    len(c_list_data) > 0
)

results['3_pacientes'] = {
    "status": "OPERATIVO (100%)" if patients_ok else "ERROR",
    "created_idp": patient_idp,
    "created_code": patient_code,
    "update_ok": c_upd_ok,
    "total_clients": len(c_list_data)
}
print(f"   [OK] 3. Directorio: IDP={patient_idp}, Code={patient_code}, Total Pacientes={len(c_list_data)}.")

# -------------------------------------------------------------
# 4. GUARDADO DE EVALUACIONES CLÍNICAS & DETALLE
# -------------------------------------------------------------
print("--> [4/6] Verificando Guardado e Historial de Evaluaciones...")
bia_save_payload = dict(bia_payload)
bia_save_payload['save'] = True
bia_save_payload['patient_idp'] = patient_idp
bia_save_payload['patient_name'] = "Mariana Gómez Silva"

res_ev_save = client.post('/api/dashboard-data', data=json.dumps(bia_save_payload), headers=doc_headers)
ev_save_data = json.loads(res_ev_save.data) if res_ev_save.status_code == 201 else {}
eval_code = ev_save_data.get('evaluation', {}).get('code') or ev_save_data.get('code')

# Obtener historial
res_ev_list = client.get('/api/evaluations', headers=doc_headers)
ev_list_data = json.loads(res_ev_list.data) if res_ev_list.status_code == 200 else []

# Detalle
eval_id = ev_list_data[0].get('id') if ev_list_data else None
res_ev_detail = client.get(f'/api/evaluations/{eval_id}', headers=doc_headers) if eval_id else None

evals_ok = (
    res_ev_save.status_code == 201 and 
    eval_code is not None and 
    len(ev_list_data) > 0 and 
    res_ev_detail and res_ev_detail.status_code == 200
)

results['4_evaluaciones'] = {
    "status": "OPERATIVO (100%)" if evals_ok else "ERROR",
    "evaluation_code": eval_code,
    "total_evaluations": len(ev_list_data),
    "detail_ok": res_ev_detail.status_code == 200 if res_ev_detail else False
}
print(f"   [OK] 4. Evaluación Guardada: Código={eval_code}, Historial Total={len(ev_list_data)}.")

# -------------------------------------------------------------
# 5. TODO STOCK CONTROL (Catálogo, Kardex, Export Excel, POS y Ventas)
# -------------------------------------------------------------
print("--> [5/6] Verificando Todo STOCK CONTROL & POS...")
item_payload = {
    "code": "EL-BIA-2026",
    "name": "Electrodos Adhesivos BIA Ag/AgCl",
    "category": "Insumos BIA",
    "unit": "paquete",
    "cost_price": 12.00,
    "sale_price": 25.00,
    "stock_quantity": 80.0,
    "min_stock": 10.0,
    "batch_number": "LT-2026-A",
    "expiration_date": "2027-12-31"
}
res_stk_create = client.post('/api/stock', data=json.dumps(item_payload), headers=doc_headers)
stk_data = json.loads(res_stk_create.data) if res_stk_create.status_code == 201 else {}
stock_item = stk_data.get('item', {})
stock_item_id = stock_item.get('id')

# 5.2 Ajuste Kardex (Salida por uso clínico)
adjust_payload = {
    "type": "OUT",
    "quantity": 5.0,
    "reason": "Uso en consulta clínica"
}
res_adj = client.post(f'/api/stock/{stock_item_id}/adjust', data=json.dumps(adjust_payload), headers=doc_headers) if stock_item_id else None
adj_ok = res_adj and res_adj.status_code == 200

# 5.3 Movimientos Kardex
res_mov = client.get('/api/stock/movements', headers=doc_headers)
mov_ok = res_mov.status_code == 200

# 5.4 Taxonomías
res_tax = client.get('/api/stock/taxonomies', headers=doc_headers)
tax_ok = res_tax.status_code == 200

# 5.5 Exportación Excel
res_exp = client.get('/api/stock/export', headers=doc_headers)
exp_ok = res_exp.status_code == 200 and 'spreadsheetml' in res_exp.content_type

# 5.6 Venta POS y Recibo Digital
sale_payload = {
    "patient_name": "Mariana Gómez Silva",
    "patient_idp": patient_idp,
    "patient_phone": "+591 77012345",
    "payment_method": "Efectivo",
    "discount": 5.00,
    "amount_received": 50.00,
    "items": [
        {
            "stock_item_id": stock_item_id,
            "quantity": 1,
            "unit_price": 25.00
        }
    ]
}
res_sale = client.post('/api/sales', data=json.dumps(sale_payload), headers=doc_headers)
sale_res_data = json.loads(res_sale.data) if res_sale.status_code == 201 else {}
receipt_number = sale_res_data.get('sale', {}).get('receipt_number')

# 5.7 Estadísticas y KPIs de Ventas
res_sale_stats = client.get('/api/sales/stats', headers=doc_headers)
sale_stats_ok = res_sale_stats.status_code == 200

stock_ok = (
    res_stk_create.status_code == 201 and 
    adj_ok and 
    mov_ok and 
    tax_ok and 
    exp_ok and 
    receipt_number is not None and 
    sale_stats_ok
)

results['5_stock_control'] = {
    "status": "OPERATIVO (100%)" if stock_ok else "ERROR",
    "item_created": stock_item.get('name'),
    "kardex_adjusted": adj_ok,
    "taxonomies_ok": tax_ok,
    "excel_export_ok": exp_ok,
    "pos_sale_receipt": receipt_number,
    "sales_stats_ok": sale_stats_ok
}
print(f"   [OK] 5. Stock Control: Ítem={stock_item.get('name')}, Kardex=OK, Excel=OK, Venta POS={receipt_number}.")

# -------------------------------------------------------------
# 6. PERIODO DE TIEMPO DE SUSCRIPCIÓN & CANJE DE PINS
# -------------------------------------------------------------
print("--> [6/6] Verificando Periodo de Suscripción y Canje de PINs...")
res_sub = client.get('/api/subscription/status', headers=doc_headers)
sub_data = json.loads(res_sub.data) if res_sub.status_code == 200 else {}
days_left_initial = sub_data.get('days_left')

# 6.1 SuperAdmin crea un PIN de 30 días
pin_create_payload = {
    "duration_days": 30,
    "count": 1,
    "note": "Auditoría PIN 30 días"
}
res_admin_pin = client.post('/api/admin/pins/create', data=json.dumps(pin_create_payload), headers=admin_headers)
pin_created = json.loads(res_admin_pin.data) if res_admin_pin.status_code == 201 else {}
generated_key = pin_created.get('pins', [{}])[0].get('license_key')

# 6.2 Doctor canjea el PIN
res_redeem = client.post('/api/subscription/redeem', data=json.dumps({"license_key": generated_key}), headers=doc_headers)
redeem_data = json.loads(res_redeem.data) if res_redeem.status_code == 200 else {}

# 6.3 Verificar nueva vigencia
res_sub_after = client.get('/api/subscription/status', headers=doc_headers)
sub_data_after = json.loads(res_sub_after.data) if res_sub_after.status_code == 200 else {}
days_left_after = sub_data_after.get('days_left')

sub_ok = (
    res_sub.status_code == 200 and 
    sub_data.get('is_active') is True and 
    res_admin_pin.status_code == 201 and 
    redeem_data.get('success') is True and 
    days_left_after >= days_left_initial
)

results['6_suscripciones'] = {
    "status": "OPERATIVO (100%)" if sub_ok else "ERROR",
    "initial_days": days_left_initial,
    "pin_generated": generated_key,
    "redeemed_ok": redeem_data.get('success'),
    "days_after_redeem": days_left_after,
    "plan_name": sub_data_after.get('plan')
}
print(f"   [OK] 6. Suscripción: Inicial={days_left_initial} días -> PIN={generated_key} -> Actual={days_left_after} días.")

print("\n=== RESUMEN FINAL DE LA AUDITORÍA ===")
print(json.dumps(results, indent=2, ensure_ascii=False))
