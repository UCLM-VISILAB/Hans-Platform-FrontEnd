import { React, useRef, useState, useEffect } from "react";

import Backdrop from '@mui/material/Backdrop';

import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import CountDown from './Countdown';
import SessionStatusView from './StatusView';
import QuestionDetails from './QuestionDetails';
import BoardView from '../BoardView';
import { Session, SessionStatus } from '../../context/Session';
import { QuestionStatus } from '../../context/Question';


export default function SessionView({ sessionId, participantId, onLeave = () => { } }) {
  const sessionRef = useRef(null);
  const sessionStatus = useRef(SessionStatus.Joining);
  const [question, setQuestion] = useState({ status: QuestionStatus.Undefined });
  const [userMagnetPosition, setUserMagnetPosition] = useState({ x: 0, y: 0, norm: [] });
  const [peerMagnetPositions, setPeerMagnetPositions] = useState({});
  const [centralCuePosition, setCentralCuePosition] = useState([]);
  const [targetDateCountdown, setTargetDateCountdown] = useState('2023-04-01T00:00:00Z');
  const answerWeight = useRef(null)

  useEffect(() => {
    window.addEventListener('beforeunload', onLeaveSessionClick);
    fetchSessionData(sessionId);
    sessionRef.current = new Session(sessionId, participantId,
      handleControlMessage,
      handleParticipantUpdate);
    // eslint-disable-next-line
  }, [sessionId, participantId]);

  function handleSetupMessage(controlMessage) {
    if (sessionStatus.current !== SessionStatus.Active) {
      if (controlMessage.question_id === null) {
        setQuestion({ status: QuestionStatus.Undefined });
      } else if (controlMessage.collection !== null) {
        setQuestion({
          status: QuestionStatus.Loading,
          collection: controlMessage.collection_id,
          id: controlMessage.question_id,
        });
      }
    }
  }

  function handleStartMessage(controlMessage) {
    setPeerMagnetPositions({});
    sessionStatus.current = SessionStatus.Active;
    answerWeight.current = 1.4
    setTargetDateCountdown((Date.now() + (controlMessage.duration - 0.5) * 1000));
  }

  function handleStartedMessage(controlMessage) {
    setPeerMagnetPositions({});
    if (sessionStatus.current !== SessionStatus.Active) {
      setTargetDateCountdown(Date.now() + ((controlMessage.duration - 0.5) * 1000));
      sessionStatus.current = SessionStatus.Active;
      answerWeight.current = 1.4
      setPeerMagnetPositions(controlMessage.positions);
    }
  }

  function handleStopMessage() {
    sessionStatus.current = SessionStatus.Waiting;
    setUserMagnetPosition({ x: 0, y: 0, norm: [] });
  }
  function handleControlMessage(controlMessage) {
    switch (controlMessage.type) {
      case 'setup':
        handleSetupMessage(controlMessage);
        break;
      case 'start':
        handleStartMessage(controlMessage);
        break;
      case 'started':
        handleStartedMessage(controlMessage);
        break;
      case 'stop':
        handleStopMessage();
        break;
      default:
        break;
    }
  }
  function handleParticipantUpdate(participantId, updateMessage) {
    if (participantId !== 0) {
      // Calcula la nueva posición
      let position = [...updateMessage.data.position]; // Copia la posición actual
      let sumPositions = position.reduce((sum, value) => sum + value, 0);
      if (sumPositions > 1) {
        // Normaliza la posición si es necesario
        position = position.map(value => value / sumPositions);
      }
      const participantPosition = {
        id: participantId,
        position: position
      };
      // Actualiza el estado solo si ha habido cambios
      setPeerMagnetPositions(prevPositions => ({
        ...prevPositions,
        [participantId]: participantPosition
      }));
    }
  }

  function fetchSessionData(sessionId) {
    fetch(
      `/api/session/${sessionId}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    ).then(res => {
      if (res.status === 200) {
        sessionStatus.current = SessionStatus.Waiting;
        res.json().then(data => {
          if (data.question_id && data.collection_id) {
            setQuestion({
              status: QuestionStatus.Loading,
              collection: data.collection_id,
              id: data.question_id,
            });
          }
        });
      } else {
        res.text().then(msg => console.log(msg));
      }
    }).catch(error => {
      console.log(error);
    });
  }

  useEffect(() => {
    let ignore = false;
    if (question.collection && question.id) {
      fetch(
        `/api/question/${question.collection}/${question.id}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      ).then(res => {
        if (res.status === 200) {
          res.json().then(data => {
            let questionId = data.question.substring(0, data.question.indexOf(":"));
            if (!ignore) {
              setQuestion({
                status: QuestionStatus.Loaded,
                id: questionId,
                prompt: data.question,
                answers: data.answers,
                image: `/api/question/${question.collection}/${questionId}/image`,
              });
              setTimeout(() => {
                sessionRef.current.publishControl({ type: 'ready', participant: participantId, session: sessionId });
              }, 100);
            }
          });
        } else {
          res.text().then(msg => console.log(msg));
        }
      }).catch(error => {
        console.log(error);
      });
    }
    return () => { ignore = true };
    // eslint-disable-next-line
  }, [question]);

  useEffect(() => {
    // Update central Cue based on magnet positions
    if (peerMagnetPositions && Object.keys(peerMagnetPositions).length !== 0) {
      const usablePeerPositions = Object.keys(peerMagnetPositions).map((k) => peerMagnetPositions[k]).filter((peerPosition) => peerPosition.position.length === question.answers.length);
      setCentralCuePosition(
        usablePeerPositions.reduce(
          (cuePosition, peerPosition) =>
            cuePosition.map((value, i) => value + peerPosition.position[i]),
          userMagnetPosition.norm
        ).map((value) => value / (1 + usablePeerPositions.length))
      );
    }
    // eslint-disable-next-line
  }, [userMagnetPosition, peerMagnetPositions]);

  const onUserMagnetMove = (position) => {
    if (sessionStatus.current !== SessionStatus.Active) return;
    let sumPositions = 0;
    for (const value of position.norm) {
      sumPositions += value;
    }
    if (sumPositions < 1) {
      setUserMagnetPosition(position);
      let adjustedPosition = position.norm.map((pos) => pos * answerWeight.current);
      if (answerWeight.current > 0.5) {
        answerWeight.current -= 0.007;
      }
      const tiempoTranscurrido = Date.now();
      const hoy = new Date(tiempoTranscurrido);
      sessionRef.current.publishUpdate({ data: { position: adjustedPosition, timeStamp: hoy.toISOString() } });
    }
  };

  const onLeaveSessionClick = () => {
    fetch(
      `/api/session/${sessionId}/participants/${participantId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    ).then(res => {
      if (res.status === 200) {
        sessionRef.current.publishControl({ type: 'leave', participant: participantId, session: sessionId });
      }
    }).catch(error => {
    });
    onLeave();
  }

  return (
    <>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={sessionStatus.current !== SessionStatus.Active}
      >
        <SessionStatusView
          sessionId={sessionId}
          sessionStatus={sessionStatus.current}
          questionStatus={question.status}
          onLeaveClick={onLeaveSessionClick}
        />
      </Backdrop>
      <Box
        component="main"
        height='100vh'
        sx={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Paper
          component="header"
          elevation={2}
          sx={{
            m: 1,
            p: 1,
            borderRadius: 2
          }}
        >
          <Typography component="h1" variant="h4" textAlign='center'>
            {question.status === QuestionStatus.Loaded ? question.prompt : "Question not defined yet"}
          </Typography>
        </Paper>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            gap: '10px',
            m: 1,
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              flex: 1, /* grow: 1, shrink: 1, basis: 0*/
              alignSelf: 'flex-start',
              bgcolor: '#EEEEEE',
              p: 1,
            }}
          >
            <QuestionDetails
              image={question.status === QuestionStatus.Loaded ? question.image : ""}
              prompt={question.status === QuestionStatus.Loaded ? question.prompt : "Question not defined yet"}
            />
            {sessionStatus.current === SessionStatus.Active && <CountDown targetDate={targetDateCountdown} />}
          </Paper>
          <Paper
            elevation={2}
            sx={{
              flex: 2, // grow: 2, shrink: 2, basis: 0
              height: '100%',
              p: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <BoardView
              answers={question.status === QuestionStatus.Loaded ? question.answers : []}
              centralCuePosition={centralCuePosition}
              peerMagnetPositions={peerMagnetPositions && Object.keys(peerMagnetPositions).map(
                k => peerMagnetPositions[k]
              )}
              userMagnetPosition={userMagnetPosition}
              onUserMagnetMove={onUserMagnetMove}
            />
          </Paper>
        </Box>
      </Box>
    </>
  );
}
