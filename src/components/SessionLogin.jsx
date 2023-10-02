import { React, useState } from "react";

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';


export default function SessionLogin({ username = null, onJoinSession=()=>{} }) {
  const [error, setError] = useState(null);

  const joinSession = async (event) => {
    event.preventDefault();
    // Recogemos el elemento que genero el evento en este caso el formulario
    const formData = new FormData(event.currentTarget);
    // Recoge el valor asociado al id del elemento
    const sessionId = formData.get('session-id');
    //Saca error si el id de la sesión no es numérico
    if(!sessionId.trim().length || isNaN(sessionId)) {
      setError({title: "Invalid session ID", msg: "Only integer numbers are valid"});
      return;
    }

    await fetch(
      `/api/session/${sessionId}/participants`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({user: formData.get('username')})
      }
    ).then(res => {
      if(res.status === 200) {
        res.json().then(data => {
          onJoinSession(data.username, data.id, sessionId);
        });
      } else {
        res.text().then(msg =>
          setError({title: "Unable to join session", msg: msg})
        );
      }
    }).catch(error => {
      setError({title: "Unable to send join request", msg: error});
    });
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h4">
          Join session
        </Typography>
        <Box component="form" onSubmit={joinSession} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="User name"
            name="username"
            autoComplete="username"
            defaultValue={username}
            autoFocus
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="session-id"
            name="session-id"
            label="Session ID"
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Join
          </Button>
          <Collapse in={error !== null}>
            <Alert
              severity="error"
              action={
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setError(null);
                  }}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              }
            >
              <AlertTitle><b>{error ?  error.title : "Error"}</b></AlertTitle>
              {error?.msg}
            </Alert>
          </Collapse>
        </Box>
      </Box>
    </Container>
  );
}
