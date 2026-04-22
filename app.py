from openai import OpenAI
from flask import Flask, send_from_directory, request, jsonify, g
import os
import json
import re
import secrets
from functools import wraps
from datetime import datetime, timezone, timedelta


app = Flask(__name__)

DEMO_USERS = {
    "admin": {
        "password": "123456",
        "role": "admin",
        "active": True,
        "failed_attempts": 0,
        "locked_until": None,
    },
    "auditor": {
        "password": "auditoria2026",
        "role": "auditor",
        "active": True,
        "failed_attempts": 0,
        "locked_until": None,
    }
}

ACTIVE_SESSIONS = {}
TRANSACTIONS = []
AUDIT_LOGS = []
TX_COUNTER = 1

# Ruta para servir el index.html desde la carpeta dist
@app.route('/',  methods=["GET",'POST'])
def serve_index():
    return send_from_directory('dist', 'index.html')

# Ruta para servir los archivos estáticos generados
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('dist', path)

client = OpenAI(
    base_url = 'http://localhost:11434/v1',
    api_key='ollama', # required, but unused
)


def _utc_now():
    return datetime.now(timezone.utc)


def _iso_now():
    return _utc_now().isoformat()


def _append_audit(event, detail, username="system", severity="info"):
    AUDIT_LOGS.append({
        "timestamp": _iso_now(),
        "event": event,
        "detail": detail,
        "username": username,
        "severity": severity,
    })
    if len(AUDIT_LOGS) > 300:
        AUDIT_LOGS.pop(0)


def _validate_password_policy(password):
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres"
    if not re.search(r"[A-Z]", password):
        return False, "La contraseña debe incluir al menos una letra mayúscula"
    if not re.search(r"[a-z]", password):
        return False, "La contraseña debe incluir al menos una letra minúscula"
    if not re.search(r"\d", password):
        return False, "La contraseña debe incluir al menos un número"
    return True, "ok"


def _extract_bearer_token(auth_header):
    if not auth_header:
        return None
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.replace("Bearer ", "", 1).strip()


def require_auth(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        token = _extract_bearer_token(request.headers.get("Authorization"))
        username = ACTIVE_SESSIONS.get(token)
        if not token or not username:
            return jsonify({"error": "No autorizado. Inicia sesión para continuar."}), 401
        user_data = DEMO_USERS.get(username)
        if not user_data or not user_data.get("active", False):
            return jsonify({"error": "Usuario inactivo o inexistente."}), 401
        g.current_user = username
        g.current_role = user_data.get("role", "auditor")
        return func(*args, **kwargs)

    return wrapper


def require_admin(func):
    @wraps(func)
    @require_auth
    def wrapper(*args, **kwargs):
        if g.current_role != "admin":
            return jsonify({"error": "Permisos insuficientes. Se requiere rol admin."}), 403
        return func(*args, **kwargs)

    return wrapper


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({"success": False, "message": "Usuario y contraseña son obligatorios"}), 400

    user = DEMO_USERS.get(username)
    if not user:
        _append_audit("login_failed", "Usuario no encontrado", username)
        return jsonify({"success": False, "message": "Credenciales inválidas"}), 401

    if not user.get("active", False):
        _append_audit("login_failed", "Usuario inactivo", username, "warning")
        return jsonify({"success": False, "message": "Usuario inactivo"}), 403

    lock_until = user.get("locked_until")
    if lock_until and _utc_now() < lock_until:
        _append_audit("login_blocked", "Usuario temporalmente bloqueado", username, "warning")
        return jsonify({"success": False, "message": "Usuario bloqueado temporalmente por intentos fallidos"}), 429

    expected_password = user.get("password")
    if expected_password != password:
        user["failed_attempts"] = int(user.get("failed_attempts", 0)) + 1
        if user["failed_attempts"] >= 3:
            user["locked_until"] = _utc_now() + timedelta(minutes=5)
            _append_audit("login_blocked", "3 intentos fallidos consecutivos", username, "high")
        else:
            _append_audit("login_failed", "Contraseña incorrecta", username)
        return jsonify({"success": False, "message": "Credenciales inválidas"}), 401

    user["failed_attempts"] = 0
    user["locked_until"] = None

    token = secrets.token_urlsafe(32)
    ACTIVE_SESSIONS[token] = username
    _append_audit("login_success", "Inicio de sesión exitoso", username)
    return jsonify({"success": True, "user": username, "role": user.get("role", "auditor"), "token": token})


@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    token = _extract_bearer_token(request.headers.get("Authorization"))
    username = ACTIVE_SESSIONS.pop(token, None)
    if username:
        _append_audit("logout", "Cierre de sesión", username)
    return jsonify({"success": True})


@app.route('/api/auth/me', methods=['GET'])
@require_auth
def auth_me():
    return jsonify({"success": True, "user": g.current_user, "role": g.current_role})


@app.route('/api/auth/change-password', methods=['POST'])
@require_auth
def change_password():
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    user = DEMO_USERS.get(g.current_user)
    if not user or user.get("password") != current_password:
        return jsonify({"success": False, "message": "La contraseña actual es incorrecta"}), 400

    is_valid, validation_message = _validate_password_policy(new_password)
    if not is_valid:
        return jsonify({"success": False, "message": validation_message}), 400

    user["password"] = new_password
    _append_audit("password_change", "Cambio de contraseña del propio usuario", g.current_user, "warning")
    return jsonify({"success": True, "message": "Contraseña actualizada"})

@app.route('/analizar-riesgos', methods=['POST'])
@app.route('/api/analizar-riesgos', methods=['POST'])
@require_auth
def analizar_riesgos():
    data = request.get_json()  # Obtener datos JSON enviados al endpoint
    activo = data.get('activo')  # Extraer el valor del activo
    if not activo:
        return jsonify({"error": "El campo 'activo' es necesario"}), 400
    
    riesgos, impactos = obtener_riesgos(activo)  # Llamar a la función para obtener riesgos e impactos
    _append_audit("risk_analysis", f"Activo analizado: {activo}", g.current_user)
    return jsonify({"activo": activo, "riesgos": riesgos, "impactos": impactos})

@app.route('/sugerir-tratamiento', methods=['POST'])
@app.route('/api/sugerir-tratamiento', methods=['POST'])
@require_auth
def sugerir_tratamiento():
    data = request.get_json()  # Obtener datos JSON enviados al endpoint
    activo = data.get('activo')  # Extraer el valor del activo
    riesgo = data.get('riesgo')  # Extraer el valor del riesgo
    impacto = data.get('impacto')  # Extraer el valor del impacto

    # Verificar que todos los campos necesarios están presentes
    if not activo or not riesgo or not impacto:
        return jsonify({"error": "Los campos 'activo', 'riesgo' e 'impacto' son necesarios"}), 400

    # Combinar riesgo e impacto para formar la entrada completa para obtener_tratamiento
    tratamiento = obtener_tratamiento(activo, riesgo, impacto)
    
    _append_audit("risk_treatment", f"Tratamiento sugerido para activo: {activo}", g.current_user)
    return jsonify({"activo": activo, "riesgo": riesgo, "impacto": impacto, "tratamiento": tratamiento})


@app.route('/api/transacciones', methods=['GET'])
@require_auth
def get_transacciones():
    return jsonify({"success": True, "items": list(reversed(TRANSACTIONS))})


@app.route('/api/transacciones', methods=['POST'])
@require_auth
def create_transaccion():
    global TX_COUNTER
    data = request.get_json(silent=True) or {}
    origen = (data.get("origen") or "").strip()
    destino = (data.get("destino") or "").strip()
    concepto = (data.get("concepto") or "").strip()

    try:
        monto = float(data.get("monto", 0))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Monto inválido"}), 400

    if not origen or not destino:
        return jsonify({"success": False, "message": "Origen y destino son obligatorios"}), 400
    if monto <= 0:
        return jsonify({"success": False, "message": "El monto debe ser mayor a 0"}), 400

    transaccion = {
        "id": TX_COUNTER,
        "origen": origen,
        "destino": destino,
        "concepto": concepto or "Transferencia",
        "monto": round(monto, 2),
        "estado": "APROBADA",
        "fecha": _iso_now(),
        "creada_por": g.current_user,
    }
    TX_COUNTER += 1
    TRANSACTIONS.append(transaccion)
    _append_audit("transaction_created", f"Transacción #{transaccion['id']} creada", g.current_user)
    return jsonify({"success": True, "item": transaccion}), 201


@app.route('/api/auditoria/logs', methods=['GET'])
@require_auth
def get_audit_logs():
    return jsonify({"success": True, "items": list(reversed(AUDIT_LOGS))})


@app.route('/api/admin/users', methods=['GET'])
@require_admin
def admin_get_users():
    users = []
    for username, data in DEMO_USERS.items():
        users.append({
            "username": username,
            "role": data.get("role", "auditor"),
            "active": data.get("active", False),
            "failed_attempts": data.get("failed_attempts", 0),
        })
    return jsonify({"success": True, "items": users})


@app.route('/api/admin/users/<username>/toggle-active', methods=['POST'])
@require_admin
def admin_toggle_user(username):
    user = DEMO_USERS.get(username)
    if not user:
        return jsonify({"success": False, "message": "Usuario no encontrado"}), 404
    if username == g.current_user and user.get("active", False):
        return jsonify({"success": False, "message": "No puedes desactivarte a ti mismo"}), 400

    user["active"] = not user.get("active", False)
    user["failed_attempts"] = 0
    user["locked_until"] = None
    state = "activado" if user["active"] else "desactivado"
    _append_audit("user_toggle_active", f"Usuario {username} {state}", g.current_user, "warning")
    return jsonify({"success": True, "message": f"Usuario {state}"})


@app.route('/api/admin/users/<username>/reset-password', methods=['POST'])
@require_admin
def admin_reset_password(username):
    data = request.get_json(silent=True) or {}
    new_password = data.get("new_password") or "Cambio123"
    user = DEMO_USERS.get(username)
    if not user:
        return jsonify({"success": False, "message": "Usuario no encontrado"}), 404

    is_valid, validation_message = _validate_password_policy(new_password)
    if not is_valid:
        return jsonify({"success": False, "message": validation_message}), 400

    user["password"] = new_password
    user["failed_attempts"] = 0
    user["locked_until"] = None
    _append_audit("password_reset", f"Reset de contraseña para {username}", g.current_user, "high")
    return jsonify({"success": True, "message": "Contraseña restablecida"})


def _chat_completion(messages, max_tokens=500):
    models = [
        os.getenv("OLLAMA_MODEL", "ramiro:instruct"),
        "llama3.1:8b",
        "llama2:7b",
    ]

    last_error = None
    for model in models:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.2,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            last_error = exc

    raise RuntimeError(f"No fue posible generar respuesta del motor IA: {last_error}")


def _fallback_riesgos(activo):
    riesgos = [
        "Acceso no autorizado",
        "Indisponibilidad del servicio",
        "Fuga de información",
        "Manipulación de datos",
        "Fallo de configuración",
    ]
    impactos = [
        f"Exposición de datos sensibles en {activo}",
        f"Interrupción operativa del activo {activo}",
        f"Divulgación no autorizada de información relacionada con {activo}",
        f"Decisiones erróneas por alteración de registros en {activo}",
        f"Debilidades de seguridad por cambios inseguros en {activo}",
    ]
    return riesgos, impactos


def obtener_tratamiento(activo, riesgo, impacto):
    messages = [
        {
            "role": "system",
            "content": (
                "Responde en español. Eres especialista en ISO 27001. "
                "Proporciona un tratamiento concreto, ejecutable y breve (maximo 180 caracteres)."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Activo: {activo}\n"
                f"Riesgo: {riesgo}\n"
                f"Impacto: {impacto}\n"
                "Devuelve solo el tratamiento, sin viñetas ni encabezados."
            ),
        },
    ]
    answer = _chat_completion(messages, max_tokens=120).strip()
    return answer[:180] if answer else "Aplicar controles ISO 27001, monitoreo continuo y revisión de accesos."


def obtener_riesgos(activo):
    messages = [
        {
            "role": "system",
            "content": (
                "Responde en español como analista de riesgos ISO 27001. "
                "Debes devolver JSON valido sin texto extra."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Activo: {activo}. "
                "Devuelve exactamente 5 riesgos con impacto usando este formato JSON: "
                "{\"riesgos\":[{\"riesgo\":\"...\",\"impacto\":\"...\"}]}"
            ),
        },
    ]

    try:
        answer = _chat_completion(messages, max_tokens=700)
        # Extrae JSON aunque venga rodeado por texto o markdown.
        match = re.search(r'\{[\s\S]*\}', answer)
        json_payload = match.group(0) if match else answer
        data = json.loads(json_payload)
        items = data.get("riesgos", [])

        riesgos = [str(item.get("riesgo", "")).strip() for item in items][:5]
        impactos = [str(item.get("impacto", "")).strip() for item in items][:5]

        if len(riesgos) < 5 or len(impactos) < 5 or any(not r for r in riesgos) or any(not i for i in impactos):
            return _fallback_riesgos(activo)

        return riesgos, impactos
    except Exception:
        return _fallback_riesgos(activo)

#riesgos, impactos = obtener_riesgos("mi telefono movil")

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port="5500")