import React from "react";
import { palette } from "../../constants/theme";

/**
 * PremiumBadge.jsx
 *
 * O que este bloco faz:
 * Etiqueta estilizada em tom de "ouro translúcido" para destacar seções do layout.
 *
 * @param {Object} props.children - Texto ou elemento a exibir dentro da badge.
 * @returns {JSX.Element} Badge inline-flex.
 */
export default function PremiumBadge({ children }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs tracking-[0.18em] uppercase"
      style={{
        borderColor: `${palette.gold}55`,
        background: "rgba(212,175,55,0.08)",
        color: palette.goldLight,
      }}
    >
      {children}
    </span>
  );
}
