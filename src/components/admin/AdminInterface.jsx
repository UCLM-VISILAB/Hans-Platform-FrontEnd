import { React, useEffect, useState, useCallback } from "react";

import './AdminInterface.css';
import { Session, SessionStatus } from '../../context/Session';
import CountDown from '../session/Countdown';
import BoardView from '../BoardView';
import QuestionDetails from '../session/QuestionDetails';

export default function AdminInterface({ username, password, collections, sessions, onSessionCreated }) {
  const [selectedSession, setSelectedSession] = useState({ id: 0, duration: 0, collection_id: "", question_id: "", status: "" });
  const [participantList, setParticipantList] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(SessionStatus.Waiting);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState('');
  const [waitingCountDown, setWaitingCountDown] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState({});
  const [userMagnetPosition] = useState({ x: 0, y: 0, norm: [] });
  const [peerMagnetPositions, setPeerMagnetPositions] = useState({});
  const [centralCuePosition, setCentralCuePosition] = useState([]);
  const [targetDateCountdown, setTargetDateCountdown] = useState('2023-04-01T00:00:00Z');
  const [shouldPublishCentralPosition, setShouldPublishCentralPosition] = useState(false);
  let timerId;

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      setSelectedSession(sessions[0]);
    }
  }, [sessions]);

  const compareDates = (a, b) => {
    // Divide las cadenas en sus componentes
    const componentsA = a.split('-').map(Number);
    const componentsB = b.split('-').map(Number);
    // Crea objetos de fecha personalizados
    const dateA = new Date(componentsA[0], componentsA[1] - 1, componentsA[2], componentsA[3], componentsA[4], componentsA[5]);
    const dateB = new Date(componentsB[0], componentsB[1] - 1, componentsB[2], componentsB[3], componentsB[4], componentsB[5]);
    return dateA - dateB;
  };
  useEffect(() => {
    if (collections && Object.keys(collections).length > 0) {
      setSelectedSession((prevSelectedSession) => ({
        ...prevSelectedSession,
        collection_id: Object.keys(collections)[0],
        question_id: Object.values(collections)[0][0]
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections]);

  const getParticipantsBySession = useCallback(() => {
    fetch(
      `/api/session/${selectedSession.id}/allParticipants`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          {
            user: username,
            pass: password
          }
        )
      }
    ).then(res => {
      if (res.status === 200) {
        res.json().then(data => {
          setParticipantList(data);
        });
      } else {
        res.text().then(msg => console.log(msg));
      }
    }).catch(error => {
      console.log(error);
    });
  }, [selectedSession.id, username, password]);

  useEffect(() => {
    if (selectedSession.id !== 0) {
      getParticipantsBySession();
      setCurrentSession(new Session(selectedSession.id, 0, (controlMessage) => {
        if (controlMessage.participant !== 0) {
          if (selectedSession.id === Number(controlMessage.session)) {
            switch (controlMessage.type) {
              case 'join':
                if (sessionStatus === SessionStatus.Active) {
                  setTimeout(function () {
                    currentSession.publishControl({ type: 'setup', collection_id: selectedSession.collection_id, question_id: selectedSession.question_id });
                  }, 1000);

                }
                getParticipantsBySession();
                break;
              case 'ready':
                if (sessionStatus === SessionStatus.Active) {
                  setTimeout(function () {
                    let targetDate = new Date(targetDateCountdown);
                    currentSession.publishControl({ type: 'started', duration: (targetDate - new Date()) / 1000, positions: peerMagnetPositions });
                  }, 1000);
                }
                getParticipantsBySession();
                break;
              case 'leave':
                console.log("Sale participante");
                getParticipantsBySession();
                break;
              default:
                break;
            }
          }
        }
      },
        (participantId, updateMessage) => {
          if (participantId !== 0) {
            setPeerMagnetPositions((peerPositions) => {
              return {
                ...peerPositions,
                [participantId]: updateMessage.data.position
              }
            });
          }
        }
      )
      );
    }
    // eslint-disable-next-line
  }, [selectedSession.id, getParticipantsBySession]);

  useEffect(() => {
    // Update central Cue based on magnet positions
    if (peerMagnetPositions && Object.keys(peerMagnetPositions).length > 1) {
      const usablePeerPositions = Object.keys(peerMagnetPositions).map(
        k => peerMagnetPositions[k]
      ).filter(peerPosition => peerPosition.length === activeQuestion.answers.length);
      setCentralCuePosition(
        usablePeerPositions.reduce(
          (cuePosition, peerPosition) => cuePosition.map(
            (value, i) => value + peerPosition[i]
          )
        ).map(value => value / (usablePeerPositions.length))
      );
    }
    // eslint-disable-next-line
  }, [peerMagnetPositions]);

  useEffect(() => {
    if (shouldPublishCentralPosition && currentSession) {
      currentSession.publishUpdate({ data: { position: centralCuePosition, timeStamp: new Date().toISOString() } });
      setShouldPublishCentralPosition(false);
      setTimeout(() => {
        currentSession.publishControl({ type: 'stop' });
      }, 100);
    }
    // eslint-disable-next-line
  }, [shouldPublishCentralPosition, currentSession]);

  const handleSessionChange = (event) => {
    const sessionId = parseInt(event.target.value);
    const session = sessions.find(s => s.id === sessionId);
    console.log(session)
    session.question_id = selectedSession.question_id;
    session.collection_id = selectedSession.collection_id;
    session.duration = selectedSession.duration;
    setSelectedSession(session);
  }
  const handleQuestionChange = (event) => {
    setPeerMagnetPositions({});
    setSelectedSession({ ...selectedSession, question_id: event.target.value });
    fetch(
      `/api/question/${selectedSession.collection_id}/${event.target.value}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    )
      .then(res => {
        if (res.status === 200) {
          return res.json(); // Devuelve la promesa para el siguiente .then
        } else {
          return res.text().then(msg => {
            console.log(msg);
            throw new Error('Error en la solicitud');
          });
        }
      })
      .then(data => {
        let questionId = data.question.substring(0, data.question.indexOf(":"));
        setActiveQuestion({
          id: questionId,
          prompt: data.question,
          answers: data.answers,
          image: `/api/question/${selectedSession.collection_id}/${questionId}/image`,
        });
        currentSession.publishControl({ type: 'setup', collection_id: selectedSession.collection_id, question_id: questionId });
      })
      .catch(error => {
        console.log(error);
      });
  }
  const handleCollectionChange = (event) => {
    setPeerMagnetPositions({});
    setSelectedSession({ ...selectedSession, collection_id: event.target.value, question_id: collections[event.target.value][0] });
    fetch(
      `/api/question/${event.target.value}/${collections[event.target.value][0]}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    )
      .then(res => {
        if (res.status === 200) {
          return res.json(); // Devuelve la promesa para el siguiente .then
        } else {
          return res.text().then(msg => {
            console.log(msg);
            throw new Error('Error en la solicitud');
          });
        }
      })
      .then(data => {
        let questionId = data.question.substring(0, data.question.indexOf(":"));
        setActiveQuestion({
          id: questionId,
          prompt: data.question,
          answers: data.answers,
          image: `/api/question/${event.target.value}/${questionId}/image`,
        });
        currentSession.publishControl({ type: 'setup', collection_id: event.target.value, question_id: questionId });
      })
      .catch(error => {
        console.log(error);
      });
  }

  const startSession = (event) => {
    if (!waitingCountDown) {
      setPeerMagnetPositions({});
      setCentralCuePosition([0, 0, 0, 0, 0, 0]);
      currentSession.publishControl({ type: 'start', duration: selectedSession.duration });
      setSessionStatus(SessionStatus.Active);
      setTargetDateCountdown((Date.now() + selectedSession.duration * 1000 + 200))
    }
    waitOrCloseSession();
  }

  const waitOrCloseSession = () => {
    if (!waitingCountDown) {
      setWaitingCountDown(true);
      timerId = setTimeout(() => {
        setShouldPublishCentralPosition(true); // Marcar que se debe publicar la posición central
        setWaitingCountDown(false);
        setTargetDateCountdown(Date.now());
        setSessionStatus(SessionStatus.Waiting);
      }, selectedSession.duration * 1000);
    } else {
      clearTimeout(timerId);
      setShouldPublishCentralPosition(true); // Marcar que se debe publicar la posición central
      setWaitingCountDown(false);
      setTargetDateCountdown(Date.now());
      setSessionStatus(SessionStatus.Waiting);
    }
  };
  const createSession = (event) => {
    fetch(
      `/api/createSession`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          {
            user: username,
            pass: password
          }
        )
      }
    ).then(res => {
      if (res.status === 200) {
        res.json().then(data => {
          onSessionCreated(data);
        });
      } else {
        res.text().then(msg => console.log(msg));
      }
    }).catch(error => {
      console.log(error);
    });
  }
  const downloadLastFolder = async () => {
    let folderPath = logs[logs.length - 1];
    setSelectedLog(folderPath);
    await new Promise((resolve) => setTimeout(resolve, 0)); // Esperar un ciclo de eventos para que setSelectedLog termine de actualizar
    fetch(`/api/downloadLog/${logs[logs.length - 1]}`)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        let folder_name = folderPath + ".zip";
        link.setAttribute('download', folder_name);
        document.body.appendChild(link);
        link.click();
      })
      .catch(error => {
        console.log(error);
      });
  };
  const downloadFolder = () => {
    let folderPath = selectedLog
    fetch(`/api/downloadLog/${folderPath}`)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        let folder_name = folderPath + ".zip";
        link.setAttribute('download', folder_name);
        document.body.appendChild(link);
        link.click();
      })
      .catch(error => {
        console.log(error);
      });
  };
  const downloadAllLogs = () => {
    fetch(`/api/downloadAllLogs`)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        let folder_name = "AllLogs.zip";
        link.setAttribute('download', folder_name);
        document.body.appendChild(link);
        link.click();
      })
      .catch(error => {
        console.log(error);
      });
  };

  const fetchlogs = async () => {
    try {
      const response = await fetch('/api/listLogs');
      const data = await response.json();
      setLogs(data.logs.filter(item => item !== "zips").sort(compareDates));

    } catch (error) {
      console.log(error);
    }
  };
  const handleLogSelect = (event) => {
    const selectedLog = event.target.value;
    setSelectedLog(selectedLog);
  };
  return (
    <div className="admin-interface">
      <div className="left-column">
        <div className="sessionlist">
          <select onChange={handleSessionChange} disabled={waitingCountDown}>
            {sessions && sessions.map(session => (
              <option key={session.id} value={session.id}>Session {session.id}</option>
            ))}
          </select>
          <button onClick={createSession}>New Session</button>
        </div>

        <div className="sessiondetails">
          <label>Id:</label>
          <input type="text" readOnly value={selectedSession && selectedSession.id} />
          <label>Duration:</label>
          <input type="text" value={selectedSession ? selectedSession.duration : ""} onChange={e => setSelectedSession({ ...selectedSession, duration: e.target.value })} />
          <label>Collection:</label>
          <select onChange={handleCollectionChange} disabled={waitingCountDown}>
            {collections && Object.keys(collections).map(collectionKey => (
              <option key={collectionKey} value={collectionKey}>
                {collectionKey}
              </option>
            ))}
          </select>
          <label>Question:</label>
          <select onChange={handleQuestionChange} disabled={waitingCountDown}>
            {collections && collections[selectedSession.collection_id] && Object.values(collections[selectedSession.collection_id]).map(collectionQuestion => (
              <option key={collectionQuestion} value={collectionQuestion}>
                {collectionQuestion}
              </option>
            ))}
          </select>
        </div>

        <div className="startsession">
          <button onClick={startSession}>{waitingCountDown ? "Stop" : "Start"}</button>
          <label>Ready: {participantList ? participantList.filter(participant => participant.status === 'ready').length : 0}/{participantList ? participantList.length : 0}</label>
          <textarea className="inputParticipant" readOnly value={participantList ? participantList.map(p => `${p.username} -> ${p.status}`).join("\n") : "Sin participantes todavía"} />
        </div>
      </div>

      <div className="center-column">
        <div>
          <QuestionDetails
            image={activeQuestion.id ? activeQuestion.image : ""}
            prompt={activeQuestion.id ? activeQuestion.prompt : "Question not defined yet"}
          />
          <CountDown targetDate={targetDateCountdown} />
        </div>
        <div className="loglist">
          <label id="label-log">List of logs:({logs ? logs.length : 0})</label>
          <select value={selectedLog} onChange={handleLogSelect}>
            <option value="">Select log</option>
            {logs.map(log => {
              if (log !== "zips") {
                return <option key={log} value={log}>{log}</option>;
              }
              return null;
            })}
          </select>
          <button onClick={fetchlogs}>Get logs</button>
          <button onClick={downloadFolder}>Download selected log</button>
          <button onClick={downloadLastFolder}>Download last log</button>
          <button onClick={downloadAllLogs}>Download all logs</button>
        </div>
      </div>

      <div className="right-column">
        <BoardView
          answers={activeQuestion.answers ? activeQuestion.answers : []}
          centralCuePosition={centralCuePosition}
          peerMagnetPositions={peerMagnetPositions && Object.keys(peerMagnetPositions).map(
            k => peerMagnetPositions[k]
          )}
          userMagnetPosition={userMagnetPosition}
          onUserMagnetMove={null}
        />
      </div>
    </div>
  );
}