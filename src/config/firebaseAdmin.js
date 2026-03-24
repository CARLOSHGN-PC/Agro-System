import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Se a chave não existir em dev, ele avisa. Em prod no Render, será configurada via variável de ambiente.
// Você pode passar FIREBASE_SERVICE_ACCOUNT como uma string JSON (ex: Render env vars)
// Ou confiar no GOOGLE_APPLICATION_CREDENTIALS
if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } catch (error) {
             console.error("Erro ao parsear FIREBASE_SERVICE_ACCOUNT: ", error);
             admin.initializeApp();
        }
    } else {
         // Fallback default
        admin.initializeApp();
    }
}

export const adminAuth = admin.auth();
export const adminFirestore = admin.firestore();
