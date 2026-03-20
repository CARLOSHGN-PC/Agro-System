import React from "react";
import { palette } from "../../constants/theme";

/**
 * GlowOrb.jsx
 *
 * O que este bloco faz:
 * Um orbe difuso em background, animado via Framer Motion.
 *
 * Por que ele existe:
 * Para dar a estética "premium/futurista" à tela inicial de login e ao mapa.
 *
 * O que entra e o que sai:
 * @param {string} className - Classes Tailwind extras (ex: cores, posições).
 * @param {number} size - O tamanho base do orbe.
 * @param {number} delay - O delay inicial da animação contínua (Framed Motion).
 * @returns {JSX.Element} Uma `div` animada posicionada no DOM absoluto.
 */
import { motion } from "framer-motion";

export default function GlowOrb({ className = "", size = 280, delay = 0 }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-30 ${className}`}
      style={{ width: size, height: size }}
      animate={{ x: [0, 24, -16, 0], y: [0, -20, 14, 0], scale: [1, 1.08, 0.96, 1] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}
