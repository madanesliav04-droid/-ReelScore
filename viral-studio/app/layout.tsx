import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./dashboard.css";

export const viewport:Viewport={themeColor:"#07080b",width:"device-width",initialScale:1};
export const metadata: Metadata = {title:"Viral Studio — Clip. Edit. Analyze. Export.",description:"Turn any video into short-form content that performs.",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"Viral Studio"}};

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
