import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./dashboard.css";

export const viewport:Viewport={themeColor:"#080a0e",width:"device-width",initialScale:1,viewportFit:"cover"};
export const metadata:Metadata={
  title:{default:"Social+ — Ton studio vidéo",template:"%s · Social+"},
  description:"Edit+ pour le montage intelligent. Viral+ pour les analyses éditoriales argumentées. Deux outils, un seul studio vidéo.",
  applicationName:"Social+",
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"Social+"},
  icons:{icon:"/icon.svg",shortcut:"/icon.svg",apple:"/icon.svg"},
  openGraph:{type:"website",locale:"fr_FR",title:"Social+ — Ton studio vidéo",description:"Edit+. Viral+. Un studio vidéo mobile, sans superflu."}
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
