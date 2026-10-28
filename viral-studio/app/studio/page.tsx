import Link from 'next/link';
import {redirect} from 'next/navigation';
import {standaloneTarget} from '@/lib/standalone-target';
export const dynamic='force-dynamic';
export default function Studio(){
 const origin=standaloneTarget(process.env.SOCIALPLUS_STANDALONE_ORIGIN,process.env.SOCIALPLUS_STANDALONE_VERIFIED);
 // Do not forward query strings, Vercel sharing capabilities or credentials.
 // Full uploads, cookie auth and rendering stay on the backend's one HTTPS origin.
 if(origin)redirect(origin);
 return <main className="info-page"><Link href="/apercu">← Social+</Link><h1>Le studio connecté.</h1><p>Le serveur Social+ complet est préparé : comptes privés, vidéos sauvegardées, analyse locale et moteurs de montage. Son hébergement de test n’est pas encore activé.</p><p role="status">Aucun serveur isolé vérifié n’est configuré. Aucun import serveur, rendu ou score fictif n’est proposé.</p><Link href="/analyse-locale">Importer une vidéo pour le contrôle technique sur cet appareil →</Link></main>;
}
