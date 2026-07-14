"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

function ArticleMotionShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, transform: "translateY(18px)" }}
      animate={{ opacity: 1, transform: "translateY(0)" }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export { ArticleMotionShell };
