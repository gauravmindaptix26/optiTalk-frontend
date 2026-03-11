import React, { useMemo } from "react";

const particleValue = (index, multiplier, offset = 0) =>
  ((index * multiplier + offset) % 100) / 100;

const FloatingParticles = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => ({
        left: `${particleValue(index, 37, 11) * 100}%`,
        width: `${2 + particleValue(index, 29, 7) * 4}px`,
        height: `${2 + particleValue(index, 53, 3) * 4}px`,
        animationDelay: `${particleValue(index, 41, 19) * 5}s`,
        animationDuration: `${15 + particleValue(index, 67, 13) * 10}s`,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((particle, index) => (
        <div
          key={index}
          className="absolute rounded-full bg-purple-400/20 animate-float"
          style={particle}
        />
      ))}
    </div>
  );
};

export default FloatingParticles;
