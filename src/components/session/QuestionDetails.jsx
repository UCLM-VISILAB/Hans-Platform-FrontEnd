import React, { useEffect, useState } from "react";
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function QuestionDetails({ image, prompt }) {
  const [imageSize, setImageSize] = useState({ width: 'auto', height: 'auto' });
  const [fontSize, setFontSize] = useState('1rem');

  useEffect(() => {
    const img = new Image();
    img.src = image;

    img.onload = () => {
      const maxHeightPercentage = 35; // Puedes ajustar este porcentaje según tus necesidades
      const windowHeight = window.innerHeight;
      const maxHeight = (windowHeight * maxHeightPercentage) / 100;

      const width = img.width;
      const height = img.height;
      let newWidth = width;
      let newHeight = height;

      if (height > maxHeight) {
        const ratio = maxHeight / height;
        newHeight = maxHeight;
        newWidth = width * ratio;
      }

      setImageSize({ width: newWidth, height: newHeight });

      // Calcular el tamaño de fuente proporcional a la altura de la pantalla
      const fontSizePercentage = 4; // Puedes ajustar este porcentaje según tus necesidades
      let calculatedFontSize = (windowHeight * fontSizePercentage) / 100;

      // Establecer un límite superior para el tamaño de fuente
      const maxFontSize = 25;
      calculatedFontSize = Math.min(calculatedFontSize, maxFontSize);

      setFontSize(`${calculatedFontSize}px`);
    };
  }, [image]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <img
        src={image}
        alt="question 1"
        width={imageSize.width}
        height={imageSize.height}
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      <Typography component="h4" variant="h6" textAlign='center' style={{ fontSize }}>
        <b>{prompt}</b>
      </Typography>
    </Box>
  );
}
