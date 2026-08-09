import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Theme provider backed by next-themes.
 * - attribute="data-theme": writes the theme onto <html data-theme="dark">,
 *   which our semantic tokens (src/styles/tokens.css) key off.
 * - storageKey="theme": persists the choice to localStorage.
 * - enableSystem={false}: desktop app, no OS-follow needed.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
