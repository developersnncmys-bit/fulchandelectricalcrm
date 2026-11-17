/** UI-only demo mode: no database or backend is used. Set NEXT_PUBLIC_DEMO=false to use the real backend. */
export const DEMO = process.env.NEXT_PUBLIC_DEMO !== "false";
export const DEMO_COOKIE = "fe_demo";
export const DEMO_PASSWORD = "Fulchand@123";
