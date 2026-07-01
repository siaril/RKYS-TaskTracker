-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "whatsappSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "whatsappNotifications" BOOLEAN NOT NULL DEFAULT false;
