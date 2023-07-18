import { React, useEffect, useState, useCallback } from "react";

import './AdminInterface.css';
import { Session, SessionStatus } from '../../context/Session';
import CountDown from '../session/Countdown';
import BoardView from '../BoardView';
import QuestionDetails from '../session/QuestionDetails';

export default function AdminInterface({ username, password, collections, sessions, onSessionCreated }) {
  const [selectedSession, setSelectedSession] = useState({ id: 0, duration: 0,collection_id: "", question_id: "", status: "" });
  const [participantList, setParticipantList] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(SessionStatus.Waiting);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState('');
  const [waitingCountDown, setWaitingCountDown] = useState(false);  
  const [activeQuestion, setActiveQuestion] = useState({});
  const [activeCollection, setActiveCollection] = useState({});
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

  useEffect(() => {
    if (collections && collections.length > 0 && selectedSession) {
      setActiveCollection(collections[0])
      setSelectedSession((prevSelectedSession) => ({
        ...prevSelectedSession,
        collection_id: collections[0].id,
        question_id: collections[0].questions[0].id
      }));
      setActiveQuestion(collections[0].id,collections[0].questions[0])
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
                if(sessionStatus === SessionStatus.Active){
                  setTimeout(function() {
                    currentSession.publishControl({ type: 'setup', question_id: selectedSession.question_id});
                  }, 1000);
                  
                }
                getParticipantsBySession();
                break;
              case 'ready':
                if(sessionStatus === SessionStatus.Active){
                  setTimeout(function() {
                    let targetDate = new Date(targetDateCountdown);
                    currentSession.publishControl({ type: 'started', targetDate: targetDate.toISOString() , positions: peerMagnetPositions});
                  }, 1000);
                }
                getParticipantsBySession();
                break;
              default:
                break;
            }
          }
        }
      },
      (participantId, updateMessage) => {
        if(participantId!==0){
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
  }, [peerMagnetPositions]);
  
  useEffect(() => {
    if (shouldPublishCentralPosition && currentSession) {
      currentSession.publishUpdate({ data: { position: centralCuePosition, timeStamp: new Date().toISOString() } });
      setShouldPublishCentralPosition(false);
      setTimeout(() => {
        currentSession.publishControl({ type: 'stop' });
      }, 100);
    }
  }, [shouldPublishCentralPosition, currentSession]);
  
  const handleSessionChange = (event) => {
    const sessionId = parseInt(event.target.value);
    const session = sessions.find(s => s.id === sessionId);
    session.question_id = selectedSession.question_id;
    session.duration = selectedSession.duration;
    setSelectedSession(session);
  }
  const handleQuestionChange = (event) => {
    setPeerMagnetPositions({});
    setSelectedSession({ ...selectedSession, question_id: event.target.value });
    setActiveQuestion({
      id: event.target.value,
      prompt: activeCollection.questions[event.target.value - activeCollection.firstQuestionId].prompt,
      answers: activeCollection.questions[event.target.value - activeCollection.firstQuestionId].answers,
      image: `/api/question/${activeCollection.id}/${event.target.value}/image`,
    });
    currentSession.publishControl({ type: 'setup', collection_id:activeCollection.id ,question_id: event.target.value });
  }
  const handleCollectionChange = (event) => {
    setPeerMagnetPositions({});
    setSelectedSession({ ...selectedSession,collection_id: event.target.value});
    let collection = collections.find(item => item.id === event.target.value);
    setActiveCollection(collection)
    setActiveQuestion({
      id: 1,
      prompt: collection.questions[1].prompt,
      answers: collection.questions[1].answers,
      image: `/api/question/${collection.id}/${collection.firstQuestionId}/image`,
    });
    currentSession.publishControl({ type: 'setup', collection_id:collection.id ,question_id: collection.firstQuestionId });
  }

  const startSession = (event) => {
    if(!waitingCountDown){
      setPeerMagnetPositions({});
      setCentralCuePosition([0,0,0,0,0,0]);
      currentSession.publishControl({ type: 'start', targetDate: Date.now() + selectedSession.duration * 1000 });
      setSessionStatus(SessionStatus.Active);
      setTargetDateCountdown((Date.now() + selectedSession.duration * 1000 +200))
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
      setLogs(data.logs);
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
          {collections && collections.map(collection => (
            <option key={collection.id} value={collection.id}>{collection.id}</option>
          ))}
        </select>
        <label>Question:</label>
        <select onChange={handleQuestionChange} disabled={waitingCountDown}>
          {activeCollection.questions && activeCollection.questions.map(question => (
            <option key={question.id} value={question.id}>{question.prompt}</option>
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
      <label id="label-log">Lista de logs:</label>
        <select value={selectedLog} onChange={handleLogSelect}>
          <option value="">Seleccionar log</option>
          {logs.map(log => {
            if (log !== "zips") {
              return <option key={log} value={log}>{log}</option>;
            }
            return null;
          })}
        </select>
        <button onClick={fetchlogs}>Obtener logs</button>
        <button onClick={downloadFolder}>Descargar log</button>
        <button onClick={downloadAllLogs}>Descargar todos los logs</button>
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