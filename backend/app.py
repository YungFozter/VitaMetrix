import os
import sys
import logging
from flask import Flask, render_template

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

app = Flask(
    __name__,
    template_folder='../frontend/templates',
    static_folder='../frontend/static'
)

app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024

@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self' https: data: blob:; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com https://translate.google.com https://translate.googleapis.com https://www.gstatic.com; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://unpkg.com https://www.gstatic.com https://translate.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://www.gstatic.com; "
        "img-src 'self' data: blob: https:; "
        "connect-src 'self' https: https://nominatim.openstreetmap.org https://translate.googleapis.com; "
        "frame-src 'self' https://maps.google.com https://www.google.com https://*.google.com;"
    )
    return response

# Registro de Blueprints Modulares por Dominio de Negocio
from blueprints.auth import auth_bp
from blueprints.subscriptions import subscriptions_bp
from blueprints.superadmin import superadmin_bp
from blueprints.stock import stock_bp
from blueprints.evaluations import evaluations_bp
from blueprints.clients import clients_bp
from blueprints.appointments import appointments_bp
from blueprints.sales import sales_bp
from blueprints.dashboard import dashboard_bp

app.register_blueprint(auth_bp)
app.register_blueprint(subscriptions_bp)
app.register_blueprint(superadmin_bp)
app.register_blueprint(stock_bp)
app.register_blueprint(evaluations_bp)
app.register_blueprint(clients_bp)
app.register_blueprint(appointments_bp)
app.register_blueprint(sales_bp)
app.register_blueprint(dashboard_bp)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)