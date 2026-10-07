import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest{return {name:"Viral Studio",short_name:"Viral Studio",description:"Clip. Edit. Analyze. Export.",start_url:"/dashboard",display:"standalone",background_color:"#07080b",theme_color:"#07080b",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"}]};}
