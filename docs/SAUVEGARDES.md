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

## Inventaire Cloudflare vérifié le 15 octobre 2026

- Base principale D1 : `baleti-sauvage-db` (identifiant `163fef81-98d6-4d67-b3d5-357aacb7794c`).
- Base de test D1 : `baleti-sauvage-test-v71` (identifiant `e1d784a9-1d5a-42cc-91a2-f47ee82b9aa8`).
- Compte Cloudflare : `e20930aab9d032839230bb25349916d9`.

Ces identifiants sont des références de configuration, pas des clés d'accès.

## Précautions pour l'export D1

L'API Cloudflare D1 dispose d'une opération d'export SQL, mais l'export peut temporairement rendre la base indisponible aux requêtes. Pour une première vérification, privilégier la base de test et un créneau de maintenance. Lancer un export n'est pas équivalent à disposer d'une sauvegarde : il faut récupérer le fichier SQL, le stocker dans un emplacement privé et valider sa restauration.

**Aucun export D1 n'a été lancé lors de cette préparation.**

## Backblaze B2

L'inventaire des objets B2 et la vérification d'une copie indépendante restent à réaliser. Les objets B2 doivent être sauvegardés avec leurs références D1 et les manifestes de galerie.
