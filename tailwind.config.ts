import type { Config } from "tailwindcss"
import { nextui } from "@nextui-org/react"

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Aponta para a variável que o next/font define no <body> (layout.tsx).
        // Antes daqui esta lista pedia 'SF Pro Display', que o app nunca
        // carregou — então `font-sans` caía direto no fallback do sistema.
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Superfície de marca: sempre o petróleo dominante, nos dois temas.
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // O vermelho padrão do NextUI (#F31260) não passa em contraste em nenhuma
    // das duas formas em que ele aparece: como fundo sólido com texto branco dá
    // 4,14:1, e como texto do botão "ghost" sobre o card escuro dá 3,72:1 — os
    // dois abaixo dos 4,5:1 exigidos. Como isso vale justamente para os botões
    // de excluir, vale ajustar na raiz em vez de caso a caso.
    //
    // Um tom por tema, medido: escurece no claro, clareia no escuro. Ambas as
    // formas passam a dar 6,06:1 (claro) e 5,63:1 (escuro).
    nextui({
      themes: {
        light: {
          colors: {
            danger: { DEFAULT: "#C20E4D", foreground: "#FFFFFF" },
            // Cabeçalho de tabela do NextUI: `text-foreground-500` sobre
            // `bg-default-100` dava 4,4:1 — a um décimo do mínimo. Um passo mais
            // escuro no cinza resolve (5,49:1) sem mudar o tom.
            foreground: { 500: "#62626B" },
          },
        },
        dark: {
          colors: { danger: { DEFAULT: "#FF6A8A", foreground: "#11282C" } },
        },
      },
    }),
    require("tailwind-scrollbar-hide"),
  ],
} satisfies Config
