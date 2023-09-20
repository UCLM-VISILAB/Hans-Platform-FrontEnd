import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
const CountDown = ({ targetDate }) => {
  const [countdown, setCountdown] = useState(calculateCountdown(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(calculateCountdown(targetDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  function calculateCountdown(targetDate) {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    }

    return timeLeft;
  }

  const {minutes, seconds } = countdown;

  return (
    <Box
    sx={{
      display: 'flex',  
      flexDirection: 'column',
    }}
    >
      <div>
        <Typography component="h4" variant="h6" textAlign='center'>
          {Object.keys(countdown).length ? (
            <div>
              <div>{minutes<10 && 0}{minutes}:{seconds<10 && 0}{seconds}</div>
            </div>
          ) : (
            <div>No time</div>
          )}
        </Typography>
      </div>
    </Box>
  );
};

export default CountDown;