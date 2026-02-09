import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface AnimatedBackgroundProps {
  prefersReducedMotion: boolean;
}

export function AnimatedBackground({ prefersReducedMotion }: AnimatedBackgroundProps) {
  const [isTabActive, setIsTabActive] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (prefersReducedMotion || !isTabActive) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
    );
  }

  const circles = [
    { size: 300, x: "10%", y: "20%", duration: 20, delay: 0, color: "primary" },
    { size: 200, x: "80%", y: "60%", duration: 25, delay: 2, color: "secondary" },
    { size: 150, x: "30%", y: "70%", duration: 22, delay: 4, color: "accent" },
    { size: 250, x: "70%", y: "15%", duration: 28, delay: 1, color: "primary" },
    { size: 180, x: "50%", y: "50%", duration: 24, delay: 3, color: "secondary" },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {circles.map((circle, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full opacity-10 blur-xl"
          style={{
            width: circle.size,
            height: circle.size,
            left: circle.x,
            top: circle.y,
            willChange: "transform",
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -40, 20, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{
            duration: circle.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: circle.delay,
          }}
        >
          <div
            className={`w-full h-full rounded-full ${
              circle.color === "primary"
                ? "bg-primary"
                : circle.color === "secondary"
                ? "bg-secondary"
                : "bg-accent"
            }`}
          />
        </motion.div>
      ))}
    </div>
  );
}
