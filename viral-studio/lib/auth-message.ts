// Only controlled text reaches the user; provider diagnostics stay out of the UI.
export function authMessage(error: unknown): string {
  const value = error && typeof error === "object" ? error as {code?: string; status?: number} : {};
  if (value.status === 429 || value.code?.startsWith("over_"))
    return "Trop de tentatives. Patiente quelques minutes, puis réessaie.";
  switch (value.code) {
    case "invalid_credentials": return "Email ou mot de passe incorrect. Vérifie tes identifiants puis réessaie.";
    case "email_not_confirmed": return "Confirme ton adresse depuis l’email reçu, puis reconnecte-toi.";
    case "weak_password": return "Choisis un mot de passe plus long et plus difficile à deviner.";
    case "signup_disabled": return "La création de compte est temporairement indisponible. Réessaie plus tard.";
    case "user_already_exists": return "Ce compte existe déjà. Utilise le bouton de connexion.";
    default: return "Connexion impossible pour le moment. Vérifie ton réseau, puis réessaie.";
  }
}
