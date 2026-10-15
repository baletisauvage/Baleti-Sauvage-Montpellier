# Sauvegardes et restauration

Statut : les sauvegardes automatiques et leur restauration ne sont pas encore vérifiées.

Le site dépend de quatre éléments : dépôt GitHub, Worker Cloudflare, base Cloudflare D1 et fichiers Backblaze B2.

## Procédure proposée

1. Conserver une version Git à chaque livraison.
2. Exporter quotidiennement la base D1 dans un espace privé.
3. Répliquer quotidiennement les médias B2 vers un stockage indépendant.
4. Conserver une copie des paramètres de déploiement du Worker, sans publier les identifiants.
5. Chaque mois, effectuer une restauration dans un environnement de test.
6. Vérifier que les documents, photos, vidéos et messages sont cohérents après restauration.

## Avant livraison

- [ ] Export D1 exécuté et vérifié
- [ ] Copie B2 exécutée et vérifiée
- [ ] Test de restauration documenté
- [ ] Fréquence et durée de conservation approuvées
- [ ] Personne responsable désignée

Ne pas considérer GitHub comme une sauvegarde complète de la base et des médias.
