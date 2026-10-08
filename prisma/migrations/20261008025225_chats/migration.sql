-- AlterTable
ALTER TABLE "WaState" ADD COLUMN "syncProgress" INTEGER;

-- CreateTable
CREATE TABLE "WaChat" (
    "jid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "phone" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" DATETIME,
    "lastMessageText" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WaContact" (
    "jid" TEXT NOT NULL PRIMARY KEY,
    "lid" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "notify" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WaMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatJid" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "senderName" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "timestamp" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "WaChat_lastMessageAt_idx" ON "WaChat"("lastMessageAt");

-- CreateIndex
CREATE INDEX "WaContact_lid_idx" ON "WaContact"("lid");

-- CreateIndex
CREATE INDEX "WaMessage_chatJid_timestamp_idx" ON "WaMessage"("chatJid", "timestamp");
