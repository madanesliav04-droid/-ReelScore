import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest{
  return {
    id:"/dashboard",
    name:"Social+ — Studio vidéo",
    short_name:"Social+",
    description:"Montage vidéo avec Montage et analyse éditoriale avec Analyse.",
    start_url:"/dashboard?tool=edit",
    scope:"/",
    display:"standalone",
    orientation:"any",
    background_color:"#080a0e",
    theme_color:"#080a0e",
    lang:"fr",
    icons:[
      {src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"},
      {src:"/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
      {src:"/icon-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}
    ],
    shortcuts:[
      {name:"Montage",short_name:"Montage",url:"/dashboard?tool=edit",description:"Monter une vidéo"},
      {name:"Analyse",short_name:"Analyse",url:"/dashboard?tool=viral",description:"Analyser une vidéo"}
    ]
  };
}
