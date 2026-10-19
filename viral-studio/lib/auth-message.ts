// Only controlled text reaches the user; provider diagnostics stay out of the UI.
export function authMessage(error: unknown): string {
  const value = error && typeof error === "object" ? error as {code?: string; status?: number} : {};
  if (value.status === 429 || value.code?.startsWith("over_"))
    return "Trop de tentatives. Patiente quelques minutes, puis réessaie.";
  if (value.status === 402)
    return "Social+ est momentanément indisponible : le stockage Supabase a dépassé son quota. Le compte est conservé, mais la connexion est bloquée jusqu'à la levée de la restriction.";
  if (value.status === 503 || value.status === 502 || value.status === 504)
    return "Le service de connexion est temporairement indisponible. Réessaie dans un instant.";
  if (value.code === "auth_service_unreachable")
    return "Le service d'authentification ne répond pas. Réessaie dans quelques instants.";
  if (value.status === 401 || value.status === 403)
    return "Connexion refusée. Vérifie ton email et ton mot de passe.";
  switch (value.code) {
    case "invalid_credentials": return "Email ou mot de passe incorrect. Vérifie tes identifiants puis réessaie.";
    case "email_not_confirmed": return "Confirme ton adresse depuis l’email reçu, puis reconnecte-toi.";
    case "weak_password": return "Choisis un mot de passe plus long et plus difficile à deviner.";
    case "signup_disabled": return "La création de compte est temporairement indisponible. Réessaie plus tard.";
    case "user_already_exists": return "Ce compte existe déjà. Utilise le bouton de connexion.";
    default: return "Connexion impossible : essaie dans Safari ou utilise « Mot de passe oublié ? ».";
  }
}
