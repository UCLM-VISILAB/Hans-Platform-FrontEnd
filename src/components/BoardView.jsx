import { React, useRef } from "react";

export default function BoardView({
  answers,
  centralCuePosition,
  peerMagnetPositions,
  userMagnetPosition,
  onUserMagnetMove,
  debugView = false,
}) {
  const svg = useRef();

  const magnetSize = 30;
  const halfMagnetSize = magnetSize / 2;
  const answersRadius = 340;
  const answersTextRadius = answersRadius + 25;
  let answerPoints = [];
  let answersText = [];
  for (let i = 0, angle = -Math.PI / 2; i < answers.length; i++, angle += (2 * Math.PI) / answers.length) {
    answerPoints.push({
      x: ~~(answersRadius * Math.cos(angle)),
      y: ~~(answersRadius * Math.sin(angle)),
    });
    answersText.push({
      x: ~~(answersTextRadius * Math.cos(angle)),
      y: ~~(answersTextRadius * Math.sin(angle)),
      text: answers[i],
    });
  }

  const distance = (a, b) => {
    let x = a.x - b.x,
      y = a.y - b.y;
    return Math.sqrt(x * x + y * y);
  };
  const getClosestAnswers = (point) => {
    let answerDistances = answerPoints.map((answerPoint) => distance(answerPoint, point));
    return answerDistances.map((_, i) => i).sort((a, b) => answerDistances[a] - answerDistances[b]);
  };
  const normalizePosition = (point) => {
    if (answerPoints.length < 2) return new Array(answerPoints.length).fill(0);
    // La posición se normaliza descomponiendo el punto en las dos respuestas más cercanas
    // Siendo `v1 = (a, b)` y `v2 = (c, d)` los vectores que representan las dos respuestas más cercanas
    // Sus pesos se calculan resolviendo el siguiente sistema de ecuaciones:
    //    a * w1 + b * w2 = x
    //    c * w1 + d * w2 = y

    // Obtener los índices de las dos respuestas más cercanas
    let closestAnswerIndices = getClosestAnswers(point);

    // Obtener los valores (X, Y) de los vectores correspondientes a esas respuestas
    let a = answerPoints[closestAnswerIndices[0]].x,
      b = answerPoints[closestAnswerIndices[0]].y;
    let c = answerPoints[closestAnswerIndices[1]].x,
      d = answerPoints[closestAnswerIndices[1]].y;

    // Asignar los pesos calculados a las posiciones respectivas en la posición normalizada
    let norm = new Array(answers.length).fill(0);
    const denominator = c * b - a * d;
    if (denominator === 0) {
      // Sucederá en algunos casos (es decir, cuando hay 2 respuestas y los vectores de respuesta son paralelos)
      norm[closestAnswerIndices[0]] = point.y / b;
    } else {
      norm[closestAnswerIndices[0]] = -(d * point.x - c * point.y) / denominator;
      norm[closestAnswerIndices[1]] = (b * point.x - a * point.y) / denominator;
    }
    return norm;
  };
  const denormalizePosition = (position) =>
    position.length !== answerPoints.length || answerPoints.length < 2
      ? { x: 0, y: 0 }
      : {
        x: answerPoints.map((answerPoint, i) => answerPoint.x * position[i]).reduce((sum, val) => sum + val),
        y: answerPoints.map((answerPoint, i) => answerPoint.y * position[i]).reduce((sum, val) => sum + val),
      };

  const startDrag = (event) => {
    event.preventDefault();

    const mousemove = (event) => {
      event.preventDefault();

      let cursorPoint = svg.current.createSVGPoint();
      cursorPoint.x = event.clientX;
      cursorPoint.y = event.clientY;
      cursorPoint = cursorPoint.matrixTransform(svg.current.getScreenCTM().inverse());

      const position = {
        x: Math.min(Math.max(cursorPoint.x, -500), 500),
        y: Math.min(Math.max(cursorPoint.y, -500), 500),
      };
      onUserMagnetMove({ x: position.x, y: position.y, norm: normalizePosition(position) });
    };

    document.addEventListener("mousemove", mousemove);
    document.addEventListener("mouseup", () => {
      document.removeEventListener("mousemove", mousemove);
    }, { once: true });
  };

  const cuePosition = denormalizePosition(centralCuePosition);

  const closestAnswerIndices = debugView ? getClosestAnswers(userMagnetPosition) : undefined;
  const normalizedPosition = debugView ? normalizePosition(userMagnetPosition) : undefined;

  return (
    <svg ref={svg} viewBox="-500 -500 1000 1000">
      <polygon
        points={answerPoints.map((p, i) => `${p.x},${p.y}`).join(" ")}
        stroke="blue"
        strokeWidth="5px"
        fill="none"
      />
      {/* Pintamos los puntos para las respuestas */}
      {answerPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="20"
          fill="lightgreen"
          stroke="blue"
          strokeWidth="2"
        />
      ))}

      {/* Asignamos los puntos a las respuestas */}
      {answersText.map((anchor, i) => (
        <text
          key={anchor.text}
          x={anchor.x}
          y={anchor.y}
          fill="black"
          fontSize="30"
          textAnchor={anchor.x === 0 ? "middle" : (anchor.x < 0 ? "end" : "start")}
          dominantBaseline={anchor.y === 0 ? "middle" : (anchor.y < 0 ? "ideographic" : "hanging")}
        >
          {anchor.text}
        </text>
      ))}
      {/* Círculo que marca la media de las respuestas*/}
      <circle
        cx={cuePosition.x}
        cy={cuePosition.y}
        r="80"
        fill="#DDDDDD"
        stroke="black"
        strokeWidth="2"
      />
      {/*Rectángulo que marca las respuestas de otros participantes*/}
      <g transform={`translate(-${halfMagnetSize}, -${halfMagnetSize})`}>
        {peerMagnetPositions?.map(normPosition => denormalizePosition(normPosition)).map((point, i) => (
          <rect
            key={`rect-${i}`}
            x={point.x}
            y={point.y}
            width={magnetSize}
            height={magnetSize}
            fill="#000000AA"
          />
        ))}
      </g>
      {/* DEBUG VISUALIZATION (closest answers & arrows indicating answer relevance) */}
      {debugView && answerPoints.length >= 2 && (
        <g>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" />
            </marker>
          </defs>
          {answerPoints.map((answerPoint, i) => (
            <line
              key={`line-${i}`}
              x1="0"
              y1="0"
              x2={answerPoint.x * (0.000001 + normalizedPosition[i])}
              y2={answerPoint.y * (0.000001 + normalizedPosition[i])}
              stroke="black"
              strokeWidth="4"
              markerEnd="url(#arrowhead)"
            />
          ))}
          <line x1={userMagnetPosition.x} y1={userMagnetPosition.y} x2="0" y2="0" stroke="black" />
          <line
            x1={userMagnetPosition.x}
            y1={userMagnetPosition.y}
            x2={answerPoints[closestAnswerIndices[0]].x}
            y2={answerPoints[closestAnswerIndices[0]].y}
            stroke="black"
          />
          <line
            x1={userMagnetPosition.x}
            y1={userMagnetPosition.y}
            x2={answerPoints[closestAnswerIndices[1]].x}
            y2={answerPoints[closestAnswerIndices[1]].y}
            stroke="black"
          />
        </g>
      )}
      {/* Círculo que marca la respuesta del usuario */}
      <circle
        cx={userMagnetPosition.x}
        cy={userMagnetPosition.y}
        r={magnetSize / 2}
        fill="#FF0000"
        onMouseDown={startDrag}
      />
    </svg>
  );
}