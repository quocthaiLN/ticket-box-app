import { motion } from "motion/react";
import type { ReactNode } from "react";

type AnimatedSectionProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
};

export function AnimatedSection({
  children,
  className,
  style,
  delay = 0,
  direction = "up",
}: AnimatedSectionProps) {
  const initial =
    direction === "up"
      ? { opacity: 0, y: 28 }
      : direction === "left"
        ? { opacity: 0, x: -28 }
        : direction === "right"
          ? { opacity: 0, x: 28 }
          : { opacity: 0 };

  return (
    <motion.div
      initial={initial}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

