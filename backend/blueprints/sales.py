import os
import json
import logging
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify

from services.helpers import (
    supabase,
    _clean_str,
    _get_current_user,
    _is_subscription_active,
    _safe_stock_float,
    _calc_item_status,
    _save_persisted_stock_items,
    _save_persisted_stock_movements,
    _supabase_update_stock_item,
    _supabase_insert_stock_movement,
    _get_stock_item_by_id,
    _invalidate_dashboard_cache,
    _LOCAL_STOCK_ITEMS,
    _LOCAL_STOCK_MOVEMENTS,
    _load_persisted_sales,
    _save_persisted_sales
)

sales_bp = Blueprint('sales_bp', __name__)

_LOCAL_SALES = _load_persisted_sales()

@sales_bp.route('/api/sales', methods=['GET'])
def get_sales():
    current_user = _get_current_user()
    current_uid = current_user.get('id') if current_user else None

    if supabase:
        try:
            query = supabase.table('sales').select('*, sale_items(*)').order('created_at', desc=True)
            res = query.limit(100).execute()
            if res.data is not None and len(res.data) > 0:
                remote_sales = res.data
                if current_uid and current_user.get('role') != 'admin':
                    remote_sales = [s for s in remote_sales if s.get('user_id') == current_uid]
                return jsonify(remote_sales)
        except Exception as e:
            logging.warning("No se pudieron obtener ventas desde Supabase: %s", e)

    sales = list(_LOCAL_SALES)
    if current_uid and current_user.get('role') != 'admin':
        sales = [s for s in sales if s.get('user_id') == current_uid or not s.get('user_id')]
    return jsonify(sales)

@sales_bp.route('/api/sales', methods=['POST'])
def create_sale():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401
    if not _is_subscription_active(current_user):
        return jsonify({
            "error": "Tu suscripción ha vencido. Canjea un PIN para emitir ventas y comprobantes.",
            "subscription_expired": True
        }), 403

    current_uid = current_user.get('id')
    data = request.json or {}

    patient_name = _clean_str(data.get('patient_name'), max_len=100) or "Cliente General / Venta de Mostrador"
    patient_idp = _clean_str(data.get('patient_idp'), max_len=50)
    patient_phone = _clean_str(data.get('patient_phone'), max_len=30)
    payment_method = _clean_str(data.get('payment_method'), max_len=50) or "Efectivo"
    items_raw = data.get('items', [])

    if not items_raw or not isinstance(items_raw, list):
        return jsonify({"error": "La venta debe incluir al menos un producto o insumo"}), 400

    global _LOCAL_STOCK_ITEMS
    processed_items = []
    subtotal_sum = 0.0
    cost_sum = 0.0

    for idx, raw_it in enumerate(items_raw, 1):
        item_id = str(raw_it.get('stock_item_id') or raw_it.get('id') or '')
        qty = _safe_stock_float(raw_it.get('quantity'), default=1.0, min_val=0.01)

        stock_target = _get_stock_item_by_id(item_id)
        if not stock_target:
            return jsonify({"error": f"El producto #{idx} no fue encontrado en el inventario activo."}), 404

        available_qty = _safe_stock_float(stock_target.get('stock_quantity'), 0.0)
        if available_qty < qty:
            return jsonify({
                "error": f"Stock insuficiente para '{stock_target.get('name')}'. Disponible: {available_qty} {stock_target.get('unit', 'u')}, solicitado: {qty}."
            }), 400

        unit_price = _safe_stock_float(raw_it.get('unit_price'), default=stock_target.get('sale_price', 0.0), min_val=0.0)
        cost_price = _safe_stock_float(stock_target.get('cost_price'), default=0.0, min_val=0.0)
        line_subtotal = round(qty * unit_price, 2)

        subtotal_sum += line_subtotal
        cost_sum += round(qty * cost_price, 2)

        processed_items.append({
            "stock_item_id": item_id,
            "code": stock_target.get('code', ''),
            "name": stock_target.get('name', 'Insumo'),
            "unit": stock_target.get('unit', 'u'),
            "quantity": qty,
            "unit_price": unit_price,
            "cost_price": cost_price,
            "subtotal": line_subtotal
        })

    discount = _safe_stock_float(data.get('discount'), default=0.0, min_val=0.0)
    total = round(max(0.0, subtotal_sum - discount), 2)
    profit = round(total - cost_sum, 2)
    amount_received = _safe_stock_float(data.get('amount_received'), default=total, min_val=0.0)
    change_given = round(max(0.0, amount_received - total), 2)

    sale_id = str(uuid.uuid4())
    receipt_number = f"REC-{int(datetime.now().timestamp())}"

    new_sale = {
        "id": sale_id,
        "user_id": current_uid,
        "receipt_number": receipt_number,
        "patient_name": patient_name,
        "patient_idp": patient_idp,
        "patient_phone": patient_phone,
        "subtotal": subtotal_sum,
        "discount": discount,
        "total": total,
        "total_cost": cost_sum,
        "profit": profit,
        "payment_method": payment_method,
        "amount_received": amount_received,
        "change_given": change_given,
        "status": "COMPLETED",
        "notes": _clean_str(data.get('notes'), max_len=500),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sale_items": processed_items
    }

    # Descontar stock y generar Kardex
    for p_item in processed_items:
        s_id = p_item['stock_item_id']
        qty_sold = p_item['quantity']
        target_item = _get_stock_item_by_id(s_id)
        if target_item:
            prev_q = _safe_stock_float(target_item.get('stock_quantity'), 0.0)
            new_q = round(max(0.0, prev_q - qty_sold), 2)
            upd = {
                "user_id": current_uid,
                "stock_quantity": new_q,
                "status": _calc_item_status(new_q, target_item.get('min_stock', 5)),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            for it in _LOCAL_STOCK_ITEMS:
                if str(it.get('id')) == str(s_id):
                    it.update(upd)
                    break
            _supabase_update_stock_item(s_id, upd)

            m_item = {
                "id": str(uuid.uuid4()),
                "user_id": current_uid,
                "item_id": s_id,
                "type": "SALE",
                "quantity": qty_sold,
                "previous_stock": prev_q,
                "new_stock": new_q,
                "reason": f"Venta registrada en Recibo #{receipt_number}",
                "reference_id": sale_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            _LOCAL_STOCK_MOVEMENTS.insert(0, m_item)
            _supabase_insert_stock_movement(m_item)

    _save_persisted_stock_items(_LOCAL_STOCK_ITEMS)
    _save_persisted_stock_movements(_LOCAL_STOCK_MOVEMENTS)

    _LOCAL_SALES.insert(0, new_sale)
    _save_persisted_sales(_LOCAL_SALES)

    if supabase:
        try:
            supabase.table('sales').insert({
                "id": sale_id,
                "user_id": current_uid,
                "receipt_number": receipt_number,
                "patient_name": patient_name,
                "patient_idp": patient_idp,
                "patient_phone": patient_phone,
                "subtotal": subtotal_sum,
                "discount": discount,
                "total": total,
                "total_cost": cost_sum,
                "profit": profit,
                "payment_method": payment_method,
                "amount_received": amount_received,
                "change_given": change_given,
                "status": "COMPLETED",
                "notes": new_sale['notes'],
                "created_at": new_sale['created_at']
            }).execute()

            for p_item in processed_items:
                supabase.table('sale_items').insert({
                    "id": str(uuid.uuid4()),
                    "sale_id": sale_id,
                    "stock_item_id": p_item['stock_item_id'],
                    "code": p_item['code'],
                    "name": p_item['name'],
                    "unit": p_item['unit'],
                    "quantity": p_item['quantity'],
                    "unit_price": p_item['unit_price'],
                    "cost_price": p_item['cost_price'],
                    "subtotal": p_item['subtotal']
                }).execute()
        except Exception as e:
            logging.warning("Error registrando venta en Supabase remoto: %s", e)

    _invalidate_dashboard_cache()
    return jsonify({
        "success": True,
        "sale": new_sale,
        "message": f"Venta #{receipt_number} procesada exitosamente."
    }), 201

@sales_bp.route('/api/sales/<sale_id>', methods=['GET'])
def get_sale_detail(sale_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401

    if supabase:
        try:
            res = supabase.table('sales').select('*, sale_items(*)').eq('id', str(sale_id)).execute()
            if res.data and len(res.data) > 0:
                return jsonify(res.data[0])
        except Exception:
            pass

    for s in _LOCAL_SALES:
        if str(s.get('id')) == str(sale_id):
            return jsonify(s)

    return jsonify({"error": "Venta no encontrada"}), 404

@sales_bp.route('/api/sales/<sale_id>/cancel', methods=['POST'])
def cancel_sale(sale_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "No autorizado"}), 401
    if not _is_subscription_active(current_user):
        return jsonify({
            "error": "Tu suscripción ha vencido. Canjea un PIN para anular ventas.",
            "subscription_expired": True
        }), 403

    current_uid = current_user.get('id')
    target_sale = None
    for s in _LOCAL_SALES:
        if str(s.get('id')) == str(sale_id):
            target_sale = s
            break

    if not target_sale:
        return jsonify({"error": "Venta no encontrada"}), 404

    if target_sale.get('status') == 'CANCELLED':
        return jsonify({"error": "Esta venta ya se encuentra anulada."}), 400

    target_sale['status'] = 'CANCELLED'
    target_sale['updated_at'] = datetime.now(timezone.utc).isoformat()
    _save_persisted_sales(_LOCAL_SALES)

    # Reintegrar stock y registrar Kardex
    for p_item in target_sale.get('sale_items', []):
        s_id = p_item.get('stock_item_id')
        qty_returned = p_item.get('quantity', 0)
        stock_target = _get_stock_item_by_id(s_id)
        if stock_target:
            prev_q = _safe_stock_float(stock_target.get('stock_quantity'), 0.0)
            new_q = round(prev_q + qty_returned, 2)
            upd = {
                "user_id": current_uid,
                "stock_quantity": new_q,
                "status": _calc_item_status(new_q, stock_target.get('min_stock', 5)),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            for it in _LOCAL_STOCK_ITEMS:
                if str(it.get('id')) == str(s_id):
                    it.update(upd)
                    break
            _supabase_update_stock_item(s_id, upd)

            m_item = {
                "id": str(uuid.uuid4()),
                "user_id": current_uid,
                "item_id": s_id,
                "type": "SALE_CANCEL",
                "quantity": qty_returned,
                "previous_stock": prev_q,
                "new_stock": new_q,
                "reason": f"Devolución por anulación de Venta #{target_sale.get('receipt_number')}",
                "reference_id": sale_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            _LOCAL_STOCK_MOVEMENTS.insert(0, m_item)
            _supabase_insert_stock_movement(m_item)

    _save_persisted_stock_items(_LOCAL_STOCK_ITEMS)
    _save_persisted_stock_movements(_LOCAL_STOCK_MOVEMENTS)

    if supabase:
        try:
            supabase.table('sales').update({"status": "CANCELLED"}).eq('id', str(sale_id)).execute()
        except Exception as e:
            logging.warning("No se pudo actualizar anulación en Supabase: %s", e)

    _invalidate_dashboard_cache()
    return jsonify({"success": True, "message": f"Venta #{target_sale.get('receipt_number')} anulada y stock devuelto al inventario."})
