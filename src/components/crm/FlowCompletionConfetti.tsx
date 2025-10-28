import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";

interface FlowCompletionConfettiProps {
  onComplete: () => void;
}

export const FlowCompletionConfetti: React.FC<FlowCompletionConfettiProps> = ({ onComplete }) => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <Confetti
      width={windowSize.width}
      height={windowSize.height}
      recycle={false}
      numberOfPieces={250}
      gravity={0.3}
    />
  );
};
