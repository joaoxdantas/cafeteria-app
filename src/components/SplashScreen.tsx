import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store } from 'lucide-react';
import { Shop } from '../types';

interface SplashScreenProps {
  shop: Shop;
  onComplete: () => void;
}

export function SplashScreen({ shop, onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Give time for exit animation
      setTimeout(onComplete, 1000);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden"
        >
          {/* Background Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-black to-slate-900/20" />
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.1, opacity: 0, filter: 'blur(10px)' }}
            transition={{ 
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1] // custom ease-out
            }}
            className="max-w-md w-full p-12 text-center relative z-10"
          >
            <div className="relative mb-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 1 }}
                className="absolute inset-0 bg-amber-500/20 blur-[60px] rounded-full"
              />
              {shop.splashImageUrl ? (
                <img 
                  src={shop.splashImageUrl} 
                  alt={shop.name} 
                  className="max-w-full max-h-[50vh] object-contain mx-auto relative z-10 drop-shadow-[0_20px_50px_rgba(245,158,11,0.3)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-32 h-32 mx-auto relative z-10 flex items-center justify-center bg-amber-500/10 rounded-full border-2 border-amber-500/30">
                  <Store className="w-16 h-16 text-amber-500" />
                </div>
              )}
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              <h2 className="text-5xl font-black text-white tracking-tighter mb-2">
                {shop.name}
              </h2>
              <p className="text-amber-500/60 font-black uppercase tracking-[0.3em] text-xs">
                Welcome to our shop
              </p>
            </motion.div>

            <div className="mt-12 max-w-[200px] mx-auto">
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 0.8, duration: 1.7, ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
                />
              </div>
            </div>
          </motion.div>

          {/* Decorative Elements */}
          <motion.div 
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 20, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-amber-500/5 blur-[120px] rounded-full"
          />
          <motion.div 
            animate={{ 
              rotate: -360,
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              duration: 25, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-slate-500/5 blur-[120px] rounded-full"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
