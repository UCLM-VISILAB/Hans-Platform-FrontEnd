import { React, useState } from "react";

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import BoardView from './BoardView';
import { Typography } from "@mui/material";


export default function DebugBoardView() {
  const answers = Array.from({length: 6}, (_, i) => `Answer ${i}`);
  const [positionText, setPositionText] = useState('[0, 0] => []');
  const [userMagnetPosition, setUserMagnetPosition] = useState({x: 0, y: 0, norm: Array(answers.length).fill(0)});
  const [peerMagnetPositions, setPeerMagnetPositions] = useState({});

  const onUserMagnetMove = (position) => {
    setUserMagnetPosition(position);
    setPeerMagnetPositions({});  // Check that conversion back and forth returns the same position 
    setPositionText(`[${position.x.toFixed(0)}, ${position.y.toFixed(0)}] => [${position.norm.map((p) => p.toFixed(2)).join(', ')}]`);
  };

  return (
    <Box
      component="main"
      height='100vh'
      sx={{
        display:'flex',
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
        <Typography textAlign='center'>
          <b>{positionText}</b>
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
          elevation={2}
          sx={{
            flex: 1,
            height: '100%',
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <BoardView
            answers={answers}
            centralCuePosition={Array(answers.length).fill(0)}
            peerMagnetPositions={peerMagnetPositions && Object.keys(peerMagnetPositions).map(
              k => peerMagnetPositions[k]
            )}
            userMagnetPosition={userMagnetPosition}
            onUserMagnetMove={onUserMagnetMove}
            debugView={true}
          />
        </Paper>
      </Box>
    </Box>
  )
}
