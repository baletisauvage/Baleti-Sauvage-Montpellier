# Contrôle des accès administrateur

Document de préparation à la livraison. Les vérifications ci-dessous ne constituent pas un audit de sécurité réalisé.

## Points observés

Les pages d'administration utilisent un service Cloudflare Worker pour les opérations de connexion et de gestion. Un jeton est enregistré dans le stockage local du navigateur et transmis aux requêtes administratives.

## Recette de sécurité avant commercialisation

- [ ] Sans connexion, la lecture des données privées est refusée.
- [ ] Sans connexion, les opérations d'ajout, modification et suppression sont refusées.
- [ ] Un jeton incorrect ou expiré est refusé par le serveur.
- [ ] La déconnexion invalide la session côté serveur.
- [ ] Les tentatives répétées de connexion sont limitées.
- [ ] Les téléchargements privés nécessitent les droits attendus.
- [ ] Les fichiers invalides et trop volumineux sont refusés.
- [ ] Les règles d'origine autorisée sont vérifiées.
- [ ] Les paramètres secrets ne figurent pas dans les pages publiques.
- [ ] Les actions sensibles sont journalisées sans enregistrer de secrets.

## Précautions de livraison

Ne jamais envoyer de mot de passe dans un dépôt public. Utiliser des identifiants distincts pour les services techniques et conserver les accès de récupération dans un coffre sécurisé. Documenter la procédure de changement des accès lors du transfert au client.

**Statut : tests techniques non exécutés.** Ne pas présenter ce document comme une attestation de sécurité.
