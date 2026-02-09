import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface NarrativeBeatProps {
  message: string;
  duration?: number;
  prefersReducedMotion: boolean;
}

export function NarrativeBeat({
  message,
  duration = 3000,
  prefersReducedMotion,
}: NarrativeBeatProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration]);

  const variants = {
    hidden: { opacity: 0, y: -20, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25,
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.9,
      transition: { duration: 0.2 },
    },
  };

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          variants={prefersReducedMotion ? {} : variants}
          initial={prefersReducedMotion ? {} : "hidden"}
          animate="visible"
          exit={prefersReducedMotion ? {} : "exit"}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4"
          data-testid="narrative-beat"
          role="status"
          aria-live="polite"
        >
          <Card className="bg-primary/95 text-primary-foreground border-primary shadow-lg">
            <div className="p-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium">{message}</p>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
