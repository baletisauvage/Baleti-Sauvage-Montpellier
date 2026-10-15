# Déploiement du Coin des Sauvages

## État
L'interface publique (`forum.html`), l'interface de modération (`admin-forum.html`), le schéma D1 (`forum/schema.sql`) et le module d'API (`forum/forum-routes.js`) sont enregistrés dans GitHub.

**Le module API n'est pas encore intégré au Worker déployé. Ne pas annoncer l'ouverture du forum avant validation.**

## Prérequis
- Identifier et confirmer la liaison D1 du Worker (le module suppose `env.DB`).
- Examiner l'authentification administrateur actuelle et fournir au module un vérificateur serveur `isAdmin(request,env)`.
- Préparer une sauvegarde de D1 avant migration.
- Tester d'abord sur une base de test.

## Activation
1. Appliquer `forum/schema.sql` sur la base de test.
2. Intégrer `forumRoute(request,env,isAdmin)` au routeur Worker, sans remplacer les routes existantes.
3. Configurer et vérifier CORS pour les requêtes depuis GitHub Pages.
4. Vérifier les opérations GET/POST publiques et GET/POST administrateur.
5. Tester la limite d'un message par minute, la longueur maximale et la protection contre les scripts.
6. Vérifier qu'une réponse expire en même temps que sa discussion d'origine.
7. Prévoir une tâche de purge D1 : les messages expirés sont masqués des listes publiques, mais restent dans la base tant qu'ils ne sont pas supprimés. Exemple SQL : `DELETE FROM forum_posts WHERE expires_at < (unixepoch('now') * 1000);`.
8. Déployer la migration en production seulement après validation.
9. Ajouter alors un lien vers `forum.html` depuis la page d'accueil.

## Modération
La page `admin-forum.html` est déjà liée au menu d'administration. Elle nécessite la route `/api/forum/admin` et la route `/api/forum/moderate`. Les deux doivent valider la session côté serveur.

## Tests de réception
- [ ] Publication immédiate sans compte
- [ ] Réponses à une discussion
- [ ] Expiration de la discussion et des réponses à 72 heures
- [ ] Modération autorisée uniquement aux administrateurs
- [ ] Message masqué non visible publiquement
- [ ] Limitation de débit effective
- [ ] Purge physique des anciens messages
- [ ] Tests sur mobile et accessibilité

## Vérification réalisée le 15 octobre 2026

Le schéma du forum a été appliqué à la base D1 de test `baleti-sauvage-test-v71`. Une lecture de `sqlite_master` confirme la présence de `forum_posts` et `forum_limits`. La liaison `DB` du Worker de production pointe vers `baleti-sauvage-db` ; elle n'a pas été modifiée. Aucun message de test n'a été ajouté à la base principale.

Les tests de publication, de modération, de limitation de débit et d'expiration restent à exécuter après intégration des routes. La migration de production n'a pas été lancée.
