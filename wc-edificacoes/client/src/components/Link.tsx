import { forwardRef } from "react";
import { Link as RRLink, NavLink as RRNavLink, type LinkProps, type NavLinkProps } from "react-router-dom";

/**
 * Links do site público com View Transitions ligadas por padrão:
 * a troca de página usa a transição "FadeUpwards" e elementos marcados com
 * `heroName()` voam entre as páginas (Hero). Navegadores sem suporte navegam normalmente.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ viewTransition = true, ...props }, ref) {
  return <RRLink ref={ref} viewTransition={viewTransition} {...props} />;
});

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink({ viewTransition = true, ...props }, ref) {
  return <RRNavLink ref={ref} viewTransition={viewTransition} {...props} />;
});
