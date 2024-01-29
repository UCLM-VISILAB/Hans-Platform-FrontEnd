import React, { useRef } from "react";

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
    let closestAnswerIndices = getClosestAnswers(point);
    let a = answerPoints[closestAnswerIndices[0]].x,
      b = answerPoints[closestAnswerIndices[0]].y;
    let c = answerPoints[closestAnswerIndices[1]].x,
      d = answerPoints[closestAnswerIndices[1]].y;
    let norm = new Array(answers.length).fill(0);
    const denominator = c * b - a * d;
    if (denominator === 0) {
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
    // Evitar el scroll en el área del SVG
    if (event.pointerType === 'touch' && event.touches && event.touches.length === 1) {
      setTimeout(() => {
        event.preventDefault();
      }, 0);
    }

    const moveHandler = (event) => {
      event.preventDefault();

      let cursorPoint = getCursorPoint(event);
      const position = {
        x: Math.min(Math.max(cursorPoint.x, -500), 500),
        y: Math.min(Math.max(cursorPoint.y, -500), 500),
      };
      onUserMagnetMove({ x: position.x, y: position.y, norm: normalizePosition(position) });
    };

    const endHandler = () => {
      document.removeEventListener("pointermove", moveHandler);
      document.removeEventListener("pointerup", endHandler);
      document.removeEventListener("pointercancel", endHandler);
    };

    document.addEventListener("pointermove", moveHandler);
    document.addEventListener("pointerup", endHandler, { once: true });
    document.addEventListener("pointercancel", endHandler, { once: true });
  };

  const getCursorPoint = (event) => {
    let cursorPoint;
    if (event.touches && event.touches.length > 0) {
      cursorPoint = svg.current.createSVGPoint();
      cursorPoint.x = event.touches[0].clientX;
      cursorPoint.y = event.touches[0].clientY;
    } else {
      cursorPoint = svg.current.createSVGPoint();
      cursorPoint.x = event.clientX;
      cursorPoint.y = event.clientY;
    }
    return cursorPoint.matrixTransform(svg.current.getScreenCTM().inverse());
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
      {peerMagnetPositions &&
        peerMagnetPositions.map((participant, i) => {
          const denormalizedPosition = denormalizePosition(participant.position);
          return (
            <g key={i}>
              <rect
                x={denormalizedPosition.x}
                y={denormalizedPosition.y}
                width={magnetSize}
                height={magnetSize}
                fill="#000000AA"
              />
              <text
                x={denormalizedPosition.x + magnetSize * 1.2}
                y={denormalizedPosition.y}
                fontSize="50"
                fill="black"
                textAnchor="start"
                dominantBaseline="middle"
              >
                {participant.id}
              </text>
            </g>
          );
        })}
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
        r={3 * magnetSize / 4}
        fill="#FF0000"
        onPointerDown={startDrag}   // Cambiado de onMouseMove y onTouchMove a onPointerMove
      />
    </svg>
  );
}
