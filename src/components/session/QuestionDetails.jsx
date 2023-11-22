import React, { useEffect, useState } from "react";
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function QuestionDetails({ image, prompt }) {
  const [imageSize, setImageSize] = useState({ width: 'auto', height: 'auto' });

  useEffect(() => {
    const img = new Image();
    img.src = image;

    img.onload = () => {
      const maxWidth = 300; // Establece el máximo ancho deseado
      const maxHeight = 450; // Establece el máximo alto deseado
      const width = img.width;
      const height = img.height;
      let newWidth = width;
      let newHeight = height;

      if (height > maxHeight) {
        const ratio = maxHeight / height;
        newHeight = maxHeight;
        newWidth = width * ratio;
      }

      if (newWidth > maxWidth) {
        const ratio = maxWidth / newWidth;
        newWidth = maxWidth;
        newHeight = newHeight * ratio;
      }

      setImageSize({ width: newWidth, height: newHeight });
    };
  }, [image]);

  return (
    <Box
      sx={{
        display: 'flex',  
        flexDirection: 'column',
        alignItems:'center'
      }}
    >
      <img
        src={image} 
        alt="question 1"
        width={imageSize.width}
        height={imageSize.height}
      />
      <Typography component="h4" variant="h6" textAlign='center'>
        <b>{prompt}</b>
      </Typography>
    </Box>
  )
}