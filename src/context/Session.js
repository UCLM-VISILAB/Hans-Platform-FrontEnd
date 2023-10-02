
import mqtt from 'precompiled-mqtt';

const SessionStatus = Object.freeze({
    Joining: Symbol("joining"), // Getting session info and subscribing to MQTT topics
    Waiting: Symbol("waiting"), // Waiting for the question to be defined and loaded
    Active: Symbol("active"),   // Answering the question, all users are interacting
});

class Session {
    constructor(sessionId, participantId, controlCallback, updateCallback) {
        console.log("SESSION CONSTRUCTOR CALLED");
        this.sessionId = sessionId;
        this.participantId = participantId;

        this.client = mqtt.connect(
            `ws://${window.location.hostname}:9001/`,
            {
                clean: true,
                connectTimeout: 4000,
            }
        );
        this.client.on('connect', () => {
            console.log('[MQTT] Client connected to broker');
            //Se imprime el mensaje por consola en caso de que se haya subscrito correctamente
            if (this.participantId === 0) {
                this.client.subscribe([
                    `swarm/session/${sessionId}/control/+`,
                    `swarm/session/${sessionId}/updates/+`,
                ], (err) => {
                    if (!err) console.log("[MQTT] Subscribed to /swarm/session/+");
                });
            } else {
                this.client.subscribe([
                    `swarm/session/${sessionId}/control`,
                    `swarm/session/${sessionId}/updates/+`,
                ], (err) => {
                    if (!err) console.log("[MQTT] Subscribed to /swarm/session/#");
                });
                console.log(`swarm/session/${this.sessionId}/control/${this.participantId}`);
                this.publishControl({ type: 'join', participant: participantId, session: sessionId });
            }

        });
        this.client.on('message', (topic, message) => {
            //Guardamos los datos del topic y los spliteamos en un array de strings
            const topic_data = topic.split('/', 5);
            //Comprobamos que los datos tengan el formato correcto
            if (
                (topic_data.length < 4)
                || (topic_data[0] !== 'swarm')
                || (topic_data[1] !== 'session')
                //Para comprobar que la posicion 2 no sea vacía
                || !topic_data[2].length
                //Comprueba que sea un numero ya que esta es la posicion del id de la session
                || isNaN(topic_data[2])
            ) {
                console.log(`[MQTT] Invalid topic '${topic}'`);
                return;
            }

            if (topic_data[3] === 'control') {
                if (parseInt(participantId) !== 0 || parseInt(sessionId) === parseInt(topic_data[2])) {
                    controlCallback(JSON.parse(message));
                  }
            }
            else if (topic_data[3] === 'updates') {
                if (topic_data.length !== 5) {
                    console.log('[MQTT] An update was received in a non-participant-specific topic');
                    return;
                }
                const participantId = topic_data[4];
                if (participantId !== this.participantId) {  // Discard self updates
                    updateCallback(participantId, JSON.parse(message));
                }
            }
        });
    }
    //Para que el cliente publique un mensaje de control en el que incluirá datos en formato JSON
    publishControl(controlMessage) {
        if(this.participantId!==0){
            this.client.publish(
                `swarm/session/${this.sessionId}/control/${this.participantId}`,
                JSON.stringify(controlMessage)
            );
        }else{
            this.client.publish(
                `swarm/session/${this.sessionId}/control`,
                JSON.stringify(controlMessage)
            );
        }
    }
    //Para que el cliente publique un mensaje de actualización en el que incluirá datos en formato JSON
    //Típicamente estos datos harán referencia a la posición de la bolita de nuestro componenete BoardView
    publishUpdate(updateMessage) {
        this.client.publish(
            `swarm/session/${this.sessionId}/updates/${this.participantId}`,
            JSON.stringify(updateMessage)
        );
    }
    //Para cerrar la conexión
    close() {
        this.client.end();
    }
}

export { SessionStatus, Session };
