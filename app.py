from openai import OpenAI
from flask import Flask, send_from_directory, request, jsonify, Response
import re


app = Flask(__name__)

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

@app.route('/analizar-riesgos', methods=['POST'])
def analizar_riesgos():
    data = request.get_json()  # Obtener datos JSON enviados al endpoint
    activo = data.get('activo')  # Extraer el valor del activo
    if not activo:
        return jsonify({"error": "El campo 'activo' es necesario"}), 400
    
    riesgos, impactos = obtener_riesgos(activo)  # Llamar a la función para obtener riesgos e impactos
    return jsonify({"activo": activo, "riesgos": riesgos, "impactos": impactos})

@app.route('/sugerir-tratamiento', methods=['POST'])
def sugerir_tratamiento():
    data = request.get_json()  # Obtener datos JSON enviados al endpoint
    activo = data.get('activo')  # Extraer el valor del activo
    riesgo = data.get('riesgo')  # Extraer el valor del riesgo
    impacto = data.get('impacto')  # Extraer el valor del impacto

    # Verificar que todos los campos necesarios están presentes
    if not activo or not riesgo or not impacto:
        return jsonify({"error": "Los campos 'activo', 'riesgo' e 'impacto' son necesarios"}), 400

    # Combinar riesgo e impacto para formar la entrada completa para obtener_tratamiento
    entrada_tratamiento = f"{activo};{riesgo};{impacto}"
    tratamiento = obtener_tratamiento(entrada_tratamiento)
    
    return jsonify({"activo": activo, "riesgo": riesgo, "impacto": impacto, "tratamiento": tratamiento})


def obtener_tratamiento( riesgo ):
    response = client.chat.completions.create(
    model="ramiro:instruct",
    messages=[
    {"role": "system", "content": "Responde en español, eres una herramienta para gestion de riesgos de la iso 27000, el usuario, te ingresara un asset tecnologico, un riesgo y un impacto, tu debes responder con un posible tratamiento en menos de 200 caracteres"},
    {"role": "user", "content": "mi telefono movil;Acceso no autorizado;un atacante puede acceder a la información personal y confidencial almacenada en el teléfono móvil, como números de teléfono, correos electrónicos y contraseñas"},
    {"role": "assistant",  "content": "Establecer un bloqueo de la pantalla de inicio que requiera autenticación con contraseña o huella digital" },
    {"role": "user", "content": riesgo }
    ]
    )
    answer = response.choices[0].message.content
        
    return answer
def obtener_riesgos( activo ):
    response = client.chat.completions.create(
    model="ramiro:instruct",
    messages=[
    {"role": "system", "content": "Responde en español, eres una herramienta para gestion de riesgos de la iso 27000, el usuario, te ingresara un asset tecnologico y tu responderas con 5 posibles riesgos asociados en bullets."},
    {"role": "user", "content": "mi raspberry pi"},
    {"role": "assistant",  "content": """• **Acceso no autorizado**: terceros pueden acceder a la información almacenada o procesada en el Raspberry Pi sin permiso, lo que podría llevar a la revelación de datos confidenciales.

• **Pérdida o daño de datos**: los archivos y datos almacenados en el Raspberry Pi se pierden o dañan debido a un error en el sistema, un fallo en el hardware o una acción malintencionada.

• **Vulnerabilidades de seguridad**: El software o firmware instalados en el Raspberry Pi contienen vulnerabilidades de seguridad no detectadas y son explotados por un atacante.

• **Inseguridad de la conexión**: la conexión del Raspberry Pi a la red local o internet no esté segura y un atacante intercepta datos confidenciales o inyecta malware en el sistema.

• **Fallos hardware**: daño debido a causas como sobrecalentamiento, sobrecarga eléctrica o errores en la manufactura, lo que lleva a una pérdida de datos o inoperatividad del sistema.""" },
    {"role": "user", "content": activo }
  ]
)
    answer = response.choices[0].message.content
    patron = r'\*\*\s*(.+?)\*\*:\s*(.+?)\.(?=\s*\n|\s*$)'
    
    # Buscamos todos los patrones en la respuesta
    resultados = re.findall(patron, answer)
    
    # Separamos los resultados en dos listas: riesgos e impactos
    riesgos = [resultado[0] for resultado in resultados]
    impactos = [resultado[1] for resultado in resultados]
    
    return riesgos, impactos

#riesgos, impactos = obtener_riesgos("mi telefono movil")

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port="5500")