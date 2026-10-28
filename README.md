# Proyecto Integrador Nivel 408 · Invernadero & Domótica (EPET N° 20)

Sistema de monitoreo y automatización para invernadero y casa inteligente utilizando **Arduino**, **Ethernet Shield (W5100)** y protocolo **MQTT**, con un **Panel Web en Tiempo Real** desarrollado en HTML, CSS y JavaScript.

---

## 📋 Características Principales

* **Control de Luces:**
  * **Casa:** Control de 3 luces (Pines 7, 6 y 5) mediante pulsador con antirrebote (Pin 4).
  * **Invernadero:** Control de 4 luces de cultivo (Pines A1, A2, 9 y 8) mediante pulsador (Pin A3).
* **Monitoreo de Sensores:**
  * **Temperatura y Humedad del Aire:** Sensor DHT11 (Pin 3).
  * **Humedad del Suelo:** Sensor de humedad analógico (Pin A0).
  * **Detección de Movimiento:** Sensor PIR (Pin 2).
  * **Display LCD I2C (16x2):** Muestra lecturas alternadas en pantalla local.
* **Telemetría IoT (MQTT):**
  * Envío periódico de datos estructurados en formato JSON al broker MQTT cada 3 segundos en el tópico `G408/casa`.
  * Publicación de evento de arranque (`"inicio"`).
* **Panel de Control Web en Tiempo Real:**
  * Comunicación directa con el broker vía **WebSockets**.
  * Visualización en vivo con medidores de nivel dinámicos, gráficos de luces y consola con visor JSON.
  * Modo Demo / Simulador integrado para pruebas locales.

---

## 🔌 Asignación de Pines (Arduino Uno)

| Componente | Pin Arduino | Función | Notas |
|---|---|---|---|
| **Luz Casa 1** | Digital 7 | Salida | Iluminación casa |
| **Luz Casa 2** | Digital 6 | Salida | Iluminación casa |
| **Luz Casa 3** | Digital 5 | Salida | Iluminación casa |
| **Pulsador Casa** | Digital 4 | Entrada (Pull-up) | Toggle luces casa |
| **Luz Invernadero 2** | Analógico A1 | Salida digital | Cultivo |
| **Luz Invernadero 3** | Analógico A2 | Salida digital | Cultivo |
| **Luz Invernadero 4** | Digital 9 | Salida | Cultivo |
| **Luz Invernadero 5** | Digital 8 | Salida | Cultivo |
| **Pulsador Invernadero** | Analógico A3 | Entrada (Pull-up) | Toggle luces invernadero |
| **Sensor PIR** | Digital 2 | Entrada | Detección de presencia |
| **Sensor DHT11** | Digital 3 | Entrada/Salida | Clima ambiental |
| **Sensor de Suelo** | Analógico A0 | Entrada analógica | Humedad de tierra |
| **Pantalla LCD** | A4 (SDA), A5 (SCL) | I2C | Dirección `0x3F` |
| **Ethernet Shield (W5100)**| 10 (CS), 11 (MOSI), 12 (MISO), 13 (SCK) | SPI | **Reservados exclusivamente** para la red |

---

## 📡 Estructura del Mensaje JSON (MQTT)

Tópico: `G408/casa`

```json
{
  "Tem": 24.5,
  "HumA": 60.0,
  "HumT": 45,
  "Casa": 0,
  "Inver": 1
}
```

* `Tem`: Temperatura en °C.
* `HumA`: Porcentaje de humedad ambiente (0 - 100%).
* `HumT`: Porcentaje de humedad en tierra (0 - 100%).
* `Casa`: Estado luces casa (`1` encendidas, `0` apagadas).
* `Inver`: Estado luces invernadero (`1` encendidas, `0` apagadas).

---

## 🌐 Panel Web

Para abrir el panel, simplemente ejecuta el archivo `index.html` ubicado en la carpeta `panel_web/`.

### Configuración de Mosquitto para WebSockets
Los navegadores requieren conexión WebSocket (habitualmente puerto `9001`). En tu archivo `mosquitto.conf`:
```ini
listener 1883
allow_anonymous true

listener 9001
protocol websockets
```

---

## 🏫 Autoría
* **Institución:** EPET N° 20
* **Materia:** Robótica / Proyecto Integrador Nivel 408
