import { React } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import Header from './components/Header';
import SessionLogin from './components/SessionLogin';
import SessionView from './components/session/SessionView';
import DebugBoardView from "./components/DebugBoardView";
import AdminView from './components/admin/AdminView.jsx';

function App() {
  const navigate = useNavigate();

  const sessionId = sessionStorage.getItem('session_id');
  const participantId = sessionStorage.getItem('participant_id');
  const username = sessionStorage.getItem('username');

  const joinSession = (username, participantId, sessionId) => {
    sessionStorage.setItem('session_id', sessionId);
    sessionStorage.setItem('participant_id', participantId);
    sessionStorage.setItem('username', username);
    navigate('/session');
  };
  const leaveSession = () => {
    sessionStorage.removeItem('session_id');
    sessionStorage.removeItem('participant_id');
    sessionStorage.removeItem('username');
    navigate('/');
  };

  return (
    <>
      <Header
        username={username}
        onLeaveClick={leaveSession}
      />
      <Routes>
        <Route exact path="/" element={
          <SessionLogin
            username={username}
            onJoinSession={joinSession}
          />
        }/>
        <Route path="/session" element={
          (!sessionId || !participantId) ? (
            // User not logged in
            <Navigate to='/' />
          ) : (
            <SessionView
              sessionId={sessionId}
              participantId={participantId}
              onLeave={leaveSession}
            />
          )
        }/>
        <Route path="/debug" element={<DebugBoardView/>} />
        <Route path="/admin" element={<AdminView/>} />
      </Routes>
    </>
  )
}

export default App;
