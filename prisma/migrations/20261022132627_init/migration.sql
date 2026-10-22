CREATE TYPE "ChallengeType" AS ENUM ('REGISTER', 'LOGIN');

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'FAILED', 'UNCONFIRMED', 'CANCELLED');

CREATE TYPE "ConfirmSource" AS ENUM ('SMS', 'MANUAL');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "googleSub" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasskeyCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "challenge" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payeeVpa" TEXT NOT NULL,
    "payeeName" TEXT,
    "amountPaise" BIGINT,
    "merchantCode" TEXT,
    "categoryId" TEXT,
    "note" TEXT,
    "upiApp" TEXT,
    "rawQr" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "upiTxnId" TEXT,
    "upiRef" TEXT,
    "confirmSource" "ConfirmSource",
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayeeRule" (
    "userId" TEXT NOT NULL,
    "vpa" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "lastName" TEXT,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayeeRule_pkey" PRIMARY KEY ("userId","vpa")
);

CREATE TABLE "SmsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "upiRef" TEXT,
    "accountLast4" TEXT,
    "payeeHint" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "matchedPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

CREATE UNIQUE INDEX "PasskeyCredential_credentialId_key" ON "PasskeyCredential"("credentialId");

CREATE INDEX "PasskeyCredential_userId_idx" ON "PasskeyCredential"("userId");

CREATE UNIQUE INDEX "AuthChallenge_challenge_key" ON "AuthChallenge"("challenge");

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");

CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

CREATE UNIQUE INDEX "Payment_userId_idempotencyKey_key" ON "Payment"("userId", "idempotencyKey");

CREATE INDEX "SmsEvent_userId_receivedAt_idx" ON "SmsEvent"("userId", "receivedAt");

ALTER TABLE "PasskeyCredential" ADD CONSTRAINT "PasskeyCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayeeRule" ADD CONSTRAINT "PayeeRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SmsEvent" ADD CONSTRAINT "SmsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
