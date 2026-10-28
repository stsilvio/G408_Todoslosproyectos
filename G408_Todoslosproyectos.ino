/* PROYECTO INTEGRADOR NIVEL 408 - IMPLEMENTACION CON PROTOCOLO MQTT

- Control de luces por medio de dos botones fisicos
- Sistema de sensores que permiten monitorear variables del invernadero (Tierra,
aire y movimiento)
- Display LCD para la visualizacion de los sensores
- Implementacion con protocolo MQTT para el envio de datos a una aplicacion o
broker externo con direccion IP 192.168.0.52

  *** Correcciones para evitar conflicto con Shield W5100 ***
Nota sobre el cableado físico: Recuerda mover en tu protoboard el cable del
DHT11 al pin 3, el botón del invernadero al pin A3, y las dos luces a A1 y A2.
Con esto tu shield Ethernet mantendrá su bus SPI libre y transmitirá de forma
continua.
*/

#include <DHT.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>

#include <Ethernet.h>
#include <MQTT.h>

byte mac[] = {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF};

EthernetClient net;
MQTTClient client;

unsigned long lastMillis = 0;
const char mqtt_broker[] = "192.168.88.67";   // esta direccion no se cambia seria el docker de mi computadora (profesor) donde el arduino uno de  G408 se va a conectar al servidor  
String TopicoSalida = "G408/casa";

// LUCES DE LA CASA

int luzCasa1 = 7;
int luzCasa2 = 6;
int luzCasa3 = 5;
int botonCasa = 4;
int ESTADO_CASA = 0;

// LUCES DEL INVERNADERO

int botonInver = A3;
int luzInver2 = A1;
int luzInver3 = A2;
int luzInver4 = 9;
int luzInver5 = 8;
int ESTADO_INVER = 0;

// SENSOR DE MOVIMIENTO PIR

#define PIR_PIN 2

// SENSOR DHT11

#define DHTPIN 3
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

// PANTALLA LCD Y SENSOR DE TIERRA

LiquidCrystal_I2C lcd(0x3F, 16, 2);

const int Soil_Pin = A0;

// VARIABLES DE TIEMPO

unsigned long tiempoSensores = 0;
unsigned long tiempoPantalla = 0;
unsigned long tiempoPIR = 0;
unsigned long tiempoMQTT = 0;

const unsigned long intervaloSensores = 2500;
const unsigned long intervaloPantalla = 2500;
const unsigned long intervaloPIR = 500;
const unsigned long intervaloMQTT = 3000; // Enviar datos MQTT cada 3 segundos
bool mostrarTierra = false;

// Valores de los sensores
float temperatura = 0.0;
float humedadAire = 0.0;

int valorTierra = 0;
int humedadTierra = 0;

// Variables para evitar rebotes en los botones
int lecturaCasaAnterior = HIGH;
int estadoCasaEstable = HIGH;
unsigned long tiempoCasa = 0;

int lecturaInverAnterior = HIGH;
int estadoInverEstable = HIGH;
unsigned long tiempoInver = 0;

const unsigned long antirrebote = 50;

// IoT configuracion MQTT
void connect() {
  Serial.print("connecting...");
  while (!client.connect("G408Casa")) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println(F("\n¡Conectado exitosamente!"));
}

// CONFIGURACION INICIAL
void setup() {
  Serial.begin(115200);

  // Luces de la casa
  pinMode(luzCasa1, OUTPUT);
  pinMode(luzCasa2, OUTPUT);
  pinMode(luzCasa3, OUTPUT);

  pinMode(botonCasa, INPUT_PULLUP);

  // Luces del invernadero
  pinMode(luzInver2, OUTPUT);
  pinMode(luzInver3, OUTPUT);
  pinMode(luzInver4, OUTPUT);
  pinMode(luzInver5, OUTPUT);

  pinMode(botonInver, INPUT_PULLUP);

  // Todas las luces empiezan apagadas
  digitalWrite(luzCasa1, LOW);
  digitalWrite(luzCasa2, LOW);
  digitalWrite(luzCasa3, LOW);

  digitalWrite(luzInver2, LOW);
  digitalWrite(luzInver3, LOW);
  digitalWrite(luzInver4, LOW);
  digitalWrite(luzInver5, LOW);

  // Sensor de movimiento
  pinMode(PIR_PIN, INPUT);

  // Pantalla LCD
  lcd.init();
  lcd.backlight();

  // Sensor DHT11
  dht.begin();

  lcd.setCursor(0, 0);
  lcd.print("Sistema iniciado");

  lcd.setCursor(0, 1);
  lcd.print("Esperando...");

  lcd.setCursor(0, 1);
  lcd.print("Conectando red..");
  // Conexión de red Ethernet
  Ethernet.begin(mac);
  Serial.println("Configuracion RED:");
  Serial.print("IP: ");
  Serial.println(Ethernet.localIP());
  client.begin(mqtt_broker, net);
  connect();
  client.publish(TopicoSalida, "inicio");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Listo!");
}

// PROGRAMA PRINCIPAL

void loop() {
  client.loop();
  if (!client.connected()) {
    connect();
  }

  controlarBotones();
  leerMovimiento();
  leerSensores();
  actualizarPantalla();
  enviarDatos();
}

// CONTROL DE LOS DOS BOTONES

void controlarBotones() {
  unsigned long ahora = millis();

  // BOTON DE LA CASA
  int lecturaCasa = digitalRead(botonCasa);

  if (lecturaCasa != lecturaCasaAnterior) {
    tiempoCasa = ahora;
    lecturaCasaAnterior = lecturaCasa;
  }

  if (ahora - tiempoCasa >= antirrebote) {
    if (lecturaCasa != estadoCasaEstable) {
      estadoCasaEstable = lecturaCasa;

      if (estadoCasaEstable == LOW) {
        ESTADO_CASA = !ESTADO_CASA;

        digitalWrite(luzCasa1, ESTADO_CASA);
        digitalWrite(luzCasa2, ESTADO_CASA);
        digitalWrite(luzCasa3, ESTADO_CASA);

        if (ESTADO_CASA == 1) {
          Serial.println("Luces de la casa encendidas");
        } else {
          Serial.println("Luces de la casa apagadas");
        }
      }
    }
  }

  // BOTON DEL INVERNADERO
  int lecturaInver = digitalRead(botonInver);

  if (lecturaInver != lecturaInverAnterior) {
    tiempoInver = ahora;
    lecturaInverAnterior = lecturaInver;
  }

  if (ahora - tiempoInver >= antirrebote) {
    if (lecturaInver != estadoInverEstable) {
      estadoInverEstable = lecturaInver;

      if (estadoInverEstable == LOW) {
        ESTADO_INVER = !ESTADO_INVER;

        digitalWrite(luzInver2, ESTADO_INVER);
        digitalWrite(luzInver3, ESTADO_INVER);
        digitalWrite(luzInver4, ESTADO_INVER);
        digitalWrite(luzInver5, ESTADO_INVER);

        if (ESTADO_INVER == 1) {
          Serial.println("Luces del invernadero encendidas");
        } else {
          Serial.println("Luces del invernadero apagadas");
        }
      }
    }
  }
}

// SENSOR DE MOVIMIENTO PIR

void leerMovimiento() {
  unsigned long ahora = millis();

  if (ahora - tiempoPIR >= intervaloPIR) {
    tiempoPIR = ahora;

    bool movimiento = digitalRead(PIR_PIN);

    if (movimiento) {
      Serial.println("Movimiento detectado!");
    } else {
      Serial.println("No hay movimiento.");
    }
  }
}

// LECTURA DE SENSORES DEL INVERNADERO

void leerSensores() {
  unsigned long ahora = millis();

  if (ahora - tiempoSensores >= intervaloSensores) {
    tiempoSensores = ahora;

    temperatura = dht.readTemperature();
    humedadAire = dht.readHumidity();

    valorTierra = analogRead(Soil_Pin);

    humedadTierra = map(valorTierra, 1023, 0, 0, 100);
    humedadTierra = constrain(humedadTierra, 0, 100);

    Serial.println("--- DATOS DEL INVERNADERO ---");

    Serial.print("Valor tierra: ");
    Serial.println(valorTierra);

    Serial.print("Humedad tierra: ");
    Serial.print(humedadTierra);
    Serial.println("%");

    Serial.print("Temperatura: ");
    Serial.println(temperatura);

    Serial.print("Humedad aire: ");
    Serial.println(humedadAire);
  }
}

// ACTUALIZACION DE LA PANTALLA LCD

void actualizarPantalla() {
  unsigned long ahora = millis();
  if (ahora - tiempoPantalla >= intervaloPantalla) {
    tiempoPantalla = ahora;

    mostrarTierra = !mostrarTierra;

    lcd.clear();

    if (!mostrarTierra) {
      // Mostrar temperatura y humedad del aire
      lcd.setCursor(0, 0);
      lcd.print("Temp: ");

      if (isnan(temperatura)) {
        lcd.print("--");
      } else {
        lcd.print(temperatura, 1);
        lcd.write((uint8_t)223);
        lcd.print("C");
      }

      lcd.setCursor(0, 1);
      lcd.print("Aire: ");

      if (isnan(humedadAire)) {
        lcd.print("--");
      } else {
        lcd.print(humedadAire, 0);
        lcd.print("%");
      }
    } else {
      // Mostrar humedad de la tierra
      lcd.setCursor(0, 0);
      lcd.print("Humedad tierra:");

      lcd.setCursor(0, 1);
      lcd.print(humedadTierra);
      lcd.print("%");
    }
  }
}

void enviarDatos() {
  unsigned long ahora = millis();
  // Envío periódico controlado
  if (ahora - tiempoMQTT >= intervaloMQTT) {
    tiempoMQTT = ahora;
    if (client.connected()) {
      // JSON válido
      String json = "{\"Tem\":" + String(temperatura, 1) +
                    ",\"HumA\":" + String(humedadAire, 1) +
                    ",\"HumT\":" + String(humedadTierra) +
                    ",\"Casa\":" + String(ESTADO_CASA) +
                    ",\"Inver\":" + String(ESTADO_INVER) + "}";
      if (client.publish(TopicoSalida, json)) {
        Serial.println(F("Datos MQTT enviados con éxito:"));
        Serial.println(json);
      } else {
        Serial.println(F("Error al enviar mensaje MQTT."));
      }
    }
  }
}
