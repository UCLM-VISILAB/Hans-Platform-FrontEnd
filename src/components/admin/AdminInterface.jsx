import { React, useEffect, useState, useCallback, useRef } from "react";

import './AdminInterface.css';
import { Session, SessionStatus } from '../../context/Session';
import CountDown from '../session/Countdown';
import BoardView from '../BoardView';
import QuestionDetails from '../session/QuestionDetails';

export default function AdminInterface({ username, password, collections, sessions, onSessionCreated }) {
  const [selectedSession, setSelectedSession] = useState({ id: 0, duration: 0, collection_id: "", question_id: "", status: "" });
  const [participantList, setParticipantList] = useState(null);
  const currentSession = useRef(null);
  const sessionStatus = useRef(SessionStatus.Waiting);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState('');
  const [waitingCountDown, setWaitingCountDown] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState({});
  const [userMagnetPosition] = useState({ x: 0, y: 0, norm: [] });
  const [peerMagnetPositions, setPeerMagnetPositions] = useState([]);
  const usersMagnetPositions = useRef([]);
  const [centralCuePosition, setCentralCuePosition] = useState([]);
  const [targetDateCountdown, setTargetDateCountdown] = useState('2023-04-01T00:00:00Z');
  const targetDate = useRef('2023-04-01T00:00:00Z');
  const [shouldPublishCentralPosition, setShouldPublishCentralPosition] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  let timerId;

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      setSelectedSession(sessions[0]);
      fetchQuestion(sessions[0].collection_id, sessions[0].question_id)
        .then(questionData => {
          setActiveQuestion(questionData);
        })
        .catch(error => {
          console.log(error);
        });
    }
    // eslint-disable-next-line
  }, [sessions]);

  useEffect(() => {
    if (collections && Object.keys(collections).length > 0) {
      setSelectedSession((prevSelectedSession) => ({
        ...prevSelectedSession,
        collection_id: Object.keys(collections)[0],
        question_id: Object.values(collections)[0][0]
      }));
      fetchQuestion(Object.keys(collections)[0], Object.values(collections)[0][0])
        .then(questionData => {
          setActiveQuestion({
            id: questionData.id,
            prompt: questionData.prompt,
            answers: questionData.answers,
            image: `/api/question/${Object.keys(collections)[0]}/${questionData.id}/image`,
          });
          currentSession.current.publishControl({
            type: 'setup',
            collection_id: Object.keys(collections)[0],
            question_id: questionData.id,
          });
        })
        .catch(error => {
          console.log(error);
        });
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
      initializeSession(selectedSession);
    }
    // eslint-disable-next-line
  }, [selectedSession.id, getParticipantsBySession]);

  function initializeSession(selectedSession) {
    currentSession.current = new Session(
      selectedSession.id,
      0,
      handleControlMessage,
      handleParticipantUpdate
    );
  }

  function handleControlMessage(controlMessage) {
    if (controlMessage.participant !== 0) {
      if (selectedSession.id === Number(controlMessage.session)) {
        switch (controlMessage.type) {
          case 'join':
            getParticipantsBySession();
            break;
          case 'ready':
            if (sessionStatus.current === SessionStatus.Active) {
              currentSession.current.publishControl({
                type: 'started',
                duration: (targetDate.current - new Date()) / 1000,
                positions: usersMagnetPositions.current
              });
            }
            getParticipantsBySession();
            break;
          case 'leave':
            getParticipantsBySession();
            break;
          default:
            break;
        }
      }
    }
  }

  function handleParticipantUpdate(participantId, updateMessage) {
    if (participantId !== 0) {
      let position = updateMessage.data.position;
      let sumPositions = position.reduce((acc, value) => acc + value, 0);
      if (sumPositions > 1) {
        position = position.map(value => value / sumPositions);
      }

      // Crea un objeto clave-valor para representar la posición del participante.
      const participantPosition = {
        id: participantId,
        position: position
      };

      // Actualiza el estado de usersMagnetPositions añadiendo o reemplazando el objeto
      // correspondiente al participante.
      const updatedPositions = { ...usersMagnetPositions.current };

      // Reemplaza el objeto existente o agrega uno nuevo si es un nuevo participante.
      updatedPositions[participantId] = participantPosition;
      usersMagnetPositions.current = updatedPositions;
      setPeerMagnetPositions(updatedPositions);
    }
  }

  useEffect(() => {
    // Create an array of all valid participant positions
    const validPositions = Object.values(usersMagnetPositions.current)
      .filter((position) => position.position.length === activeQuestion.answers.length);
  
    if (validPositions.length > 0) {
      // Initialize an array to store the sum of positions
      const sumPositions = Array(validPositions[0].position.length).fill(0);
  
      // Calculate the sum of positions
      validPositions.forEach((participantPosition) => {
        for (let i = 0; i < participantPosition.position.length; i++) {
          sumPositions[i] += participantPosition.position[i];
        }
      });
  
      // Calculate the central cue position by averaging the sum of positions
      const centralCue = sumPositions.map((sum) => sum / validPositions.length);
      setCentralCuePosition(centralCue);
    }
    // eslint-disable-next-line
  }, [peerMagnetPositions]);

  useEffect(() => {
    if (shouldPublishCentralPosition && currentSession) {
      currentSession.current.publishUpdate({ data: { position: centralCuePosition, timeStamp: new Date().toISOString() } });
      setShouldPublishCentralPosition(false);
      setTimeout(() => {
        currentSession.current.publishControl({ type: 'stop', mode: isChecked?'trajectories':'normal' });
      }, 100);
    }
    // eslint-disable-next-line
  }, [shouldPublishCentralPosition, currentSession]);

  function fetchQuestion(collectionId, questionId) {
    return fetch(`/api/question/${collectionId}/${questionId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })
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
        return {
          id: questionId,
          prompt: data.question,
          answers: data.answers,
          image: `/api/question/${collectionId}/${questionId}/image`,
        };
      });
  }
  const setStatusJoinParticipants = () => {
    setParticipantList(participantList.map(participant => {
      if (participant.status === 'ready') {
        return { ...participant, status: 'joined' };
      }
      return participant; // mantener el estado si no es "ready"
    }));
  }
  const handleQuestionChange = (event) => {
    usersMagnetPositions.current = [];
    setPeerMagnetPositions([]);
    setSelectedSession({ ...selectedSession, question_id: event.target.value });
    setStatusJoinParticipants();
    fetchQuestion(selectedSession.collection_id, event.target.value)
      .then(questionData => {
        setActiveQuestion(questionData);
        currentSession.current.publishControl({
          type: 'setup',
          collection_id: selectedSession.collection_id,
          question_id: questionData.id,
        });
      })
      .catch(error => {
        console.log(error);
      });
  }
  const handleCollectionChange = (event) => {
    usersMagnetPositions.current = [];
    setPeerMagnetPositions([]);
    setSelectedSession({ ...selectedSession, collection_id: event.target.value, question_id: collections[event.target.value][0] });
    setStatusJoinParticipants();
    fetchQuestion(event.target.value, collections[event.target.value][0])
      .then(questionData => {
        setActiveQuestion({
          id: questionData.id,
          prompt: questionData.prompt,
          answers: questionData.answers,
          image: `/api/question/${event.target.value}/${questionData.id}/image`,
        });
        currentSession.current.publishControl({
          type: 'setup',
          collection_id: event.target.value,
          question_id: questionData.id,
        });
      })
      .catch(error => {
        console.log(error);
      });
  }

  const handleSessionChange = (event) => {
    const sessionId = parseInt(event.target.value);
    const session = sessions.find(s => s.id === sessionId)
    session.question_id = selectedSession.question_id;
    session.collection_id = selectedSession.collection_id;
    session.duration = selectedSession.duration;
    setSelectedSession(session);
  }
  const startSession = (event) => {
    if (!waitingCountDown) {
      sessionStatus.current = SessionStatus.Active;
      usersMagnetPositions.current = [];
      setPeerMagnetPositions([]);
      setCentralCuePosition([0, 0, 0, 0, 0, 0]);
      currentSession.current.publishControl({ type: 'start', duration: selectedSession.duration });
      targetDate.current = (Date.now() + selectedSession.duration * 1000 + 200);
      setTargetDateCountdown(targetDate.current);

    }
    waitOrCloseSession();
  }

  const waitOrCloseSession = () => {
    if (!waitingCountDown) {
      setWaitingCountDown(true);
      timerId = setTimeout(() => {
        setShouldPublishCentralPosition(true); // Marcar que se debe publicar la posición central
        setWaitingCountDown(false);
        sessionStatus.current = SessionStatus.Waiting;
      }, selectedSession.duration * 1000);
    } else {
      clearTimeout(timerId);
      setShouldPublishCentralPosition(true); // Marcar que se debe publicar la posición central
      setWaitingCountDown(false);
      setTargetDateCountdown(Date.now());
      sessionStatus.current = SessionStatus.Waiting;
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
  const compareDates = (a, b) => {
    // Divide las cadenas en sus componentes
    const componentsA = a.split('-').map(Number);
    const componentsB = b.split('-').map(Number);
    // Crea objetos de fecha personalizados
    const dateA = new Date(componentsA[0], componentsA[1] - 1, componentsA[2], componentsA[3], componentsA[4], componentsA[5]);
    const dateB = new Date(componentsB[0], componentsB[1] - 1, componentsB[2], componentsB[3], componentsB[4], componentsB[5]);
    return dateA - dateB;
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
  const downloadAllTrajectories = () => {
    fetch(`/api/downloadAllTrajectories`)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        let folder_name = "AllTrajectories.zip";
        link.setAttribute('download', folder_name);
        document.body.appendChild(link);
        link.click();
      })
      .catch(error => {
        console.log(error);
      });
  };
  const deleteTrajectories = (event) => {
    // Ask the user for confirmation before proceeding
    const userConfirmed = window.confirm("Are you sure you want to delete all trajectories?");
  
    // If the user confirms, proceed with the deletion
    if (userConfirmed) {
      fetch(`/api/deleteAllTrajectories`)
        .then(res => {
          if (res.status === 200) {
            alert("All trajectories have been successfully deleted.");
          } else {
            res.text().then(msg => console.log(msg));
          }
        })
        .catch(error => {
          console.log(error);
        });
    } else {
      // If the user cancels, you can take some action or simply exit the function
      console.log("Deletion operation canceled by the user.");
    }
  };
  const handleCheckboxChange = () => {
    // Cambia el estado al valor opuesto cuando el checkbox se marca/desmarca
    setIsChecked(!isChecked);
  };

  return (
    <div className="admin-interface">
      <div className="left-column">
        <div className="sessionlist">
          <select onChange={handleSessionChange} disabled={waitingCountDown}>
            {sessions?.map(session => (
              <option key={session.id} value={session.id}>Session {session.id}</option>
            ))}
          </select>
          <button onClick={createSession}>New Session</button>
        </div>

        <div className="sessiondetails">
          <label>Id:</label>
          <input type="text" readOnly value={selectedSession?.id} />
          <label>Duration:</label>
          <input type="text" value={selectedSession ? selectedSession.duration : ""} onChange={e => setSelectedSession({ ...selectedSession, duration: e.target.value })} />
          <label>Collection:</label>
          <select onChange={handleCollectionChange} disabled={waitingCountDown} value={selectedSession.collection_id}>
            {collections && Object.keys(collections).map(collectionKey => (
              <option key={collectionKey} value={collectionKey}>
                {collectionKey}
              </option>
            ))}
          </select>
          <label>Question:</label>
          <select onChange={handleQuestionChange} disabled={waitingCountDown} value={selectedSession.question_id}>
            {collections?.[selectedSession.collection_id]?.map(collectionQuestion => (
              <option key={collectionQuestion} value={collectionQuestion}>
                {collectionQuestion}
              </option>
            ))}
          </select>
        </div>

        <div className="startsession">
          <button onClick={startSession}>{waitingCountDown ? "Stop" : "Start"}</button>
          <label>Ready: {participantList ? participantList.filter(participant => participant.status === 'ready').length : 0}/{participantList ? participantList.length : 0}</label>
          <textarea className="inputParticipant" readOnly value={participantList ? participantList.map(p => `${p.id}.-${p.username} -> ${p.status}`).join("\n") : "Sin participantes todavía"} />
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
          <button onClick={downloadAllTrajectories}>Download all trajectories</button>
          <button onClick={deleteTrajectories}>Delete all trajectories</button>
          <div className="trajectoriesDiv">
            <label>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={handleCheckboxChange}
              />
              Save trajectories
            </label>

            <p>{isChecked?"Trajectories mode":"Normal mode"}</p>
          </div>
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