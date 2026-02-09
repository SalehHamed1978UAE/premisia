import { motion, AnimatePresence } from 'framer-motion';

interface MatrixMessageProps {
  message: string | null;
  show: boolean;
}

export function MatrixMessage({ message, show }: MatrixMessageProps) {
  return (
    <AnimatePresence>
      {show && message && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
          data-testid="matrix-message"
        >
          <div
            className="px-6 py-4 bg-black/90 border-2 border-green-500 rounded-lg"
            style={{
              boxShadow: '0 0 20px rgba(0, 255, 0, 0.5), inset 0 0 20px rgba(0, 255, 0, 0.1)',
            }}
          >
            <p
              className="text-green-400 font-mono font-bold text-lg sm:text-2xl text-center tracking-wider"
              style={{
                textShadow: '0 0 10px rgba(0, 255, 0, 0.8)',
              }}
            >
              {message}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
