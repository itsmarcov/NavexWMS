-- Phase 3 : validation produit (commentaire agent + date de decision)
ALTER TABLE "Produit" ADD COLUMN     "commentaire" TEXT,
ADD COLUMN     "date_validation" TIMESTAMP(3);
