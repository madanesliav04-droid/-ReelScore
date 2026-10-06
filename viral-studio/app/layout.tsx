import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";

export const metadata: Metadata = {title:"Viral Studio — Clip. Edit. Analyze. Export.",description:"Turn any video into short-form content that performs."};

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
