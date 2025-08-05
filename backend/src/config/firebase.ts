import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = {
  type: "service_account",
  project_id: "imageon-cc2e2",
  private_key_id: "b1f252569703ddf9f07ea4b922604b10a999cedf",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCaiyaBEP2tsAqO\n4Ize+goN79TIlQrGTkFNUa1T4SYXVHUmNoTb0lSL6eX030NtfOJkJfcrJqd4E9Og\nFgFncr99gj0JBrQIqpM+MdPOgsKCcNxTJZ93lDeCrkBeeeeF795m7dO1WjRt3I5s\n5NAJeRyLp/o3PqAp6ZrejIFx4w3hk1CSRgm3T0XXNuRxbD6JSeHQuJOOK7ouWJXu\nNBO5TX/XvitH4/F/SpZfC3WLYktdreepcdukRvP4p7zEoqLi0UtFjsV0ZHD8QDd6\nG3Kh6Dxbfuiy2c+dVNB/HWesEMWVKBLrAS4j6fpSAEy59O8fprYF3H6743LAxbke\njnRMFkBzAgMBAAECggEAHxcsbV2+MzGNxjWtkXQrDqe3nozBaKi4oXXzkULj12Cx\n2riwHMshIC6ziQJbfczYfL5YjdFOcq1Gb1fN+4JNvNG1NronAPFUAviiPFL5D6Xl\n5UJV5Qgn7L3ijD8pETxy+TESXNMjZhCvhH+5zJYVZJEsGO4b6aKp+ei5Z/B+S+l3\nfF8m+kBOHilPAi1NF5gZMc+N2urFu1+mdWXEdHHpgsto2SQeH0ClDYmp18VW3Mul\nj2zROzTAPJdVvBEjlP/4gXqZdyWtOycle+KGYpUtiVAuRtxrQg9jmJEuJrPAIcUS\nkAnKvcOwBQd9kLmee10f3oNg9y7oyUw56bWT/+jWiQKBgQDPPXbfq0Fj66ajqhXP\nLxlZPXFI7I+I5diDSNsPFel9cRv7VVKaIHv5tjtEcOE1jcbVXDxORLUTdh6k/iwe\ne7C3exHPeHKeIkHcFvdFtQFITVf/xIcH9pw3jv7dRacPAa7lRfcyWNRs651vpXMc\npiEYDlpBC9uCZe2+mMfb3cJuKQKBgQC+56fFRq12JfD742r9+GS6090KN4E/t3qc\nO2Ldgmd54zQDkdCWEcuMQimWu2XDZSiu9tOVAO7Yb4PzaNt4vYpZkiOCUFivqXk5\nNBgpNvdRwDz0slnYY45EEXjOB+Tn6eIybcMqUJDhx+gUe0k6YjrAVO/yKj4NzlgJ\noUoZ2AGVOwKBgEngzHbR8z6urDoeESZJ0QyKJc9sXYLdBUFQAJ+xHQqV/varJQZC\n3E9Z0mkEoJRZ1W8MMYdpYO/uJOCGp626RHY0TlYaxyluZvIR0dasvydKQzuvkL+a\n/3ei52J0SSjFXdboCUaOejPWDsrVPWMSKiwMOcqEcp1avtU6W80akgx5AoGBAKbJ\nK0lug1PquAzJVouGfTLAsKghcBljyoo+VBTkvlS+DI5l0Y+bAnOKxlz7YmAAvDeI\nS7gtdX7Ahs6dOMnXBs1UoRNT8Pefn9o7SjSP4imZQ2ghfd9Qs1WC0kFmojV/n/Cg\n9ta8RqgLiBaE06hfc6bfTjcLcuWK9l2LfXrwvglLAoGBAJq/cihX6Upk2GSjfuwr\nw5MSTDcU9UukO3FKACc+dFInsSmLfsX+d5RvZUWe/LvNZbp8jLvWvbMXcLepnOlo\nIoV4KgSRFKDmtJ1uBEaOfbv9QFaLhQLpM/G8vk0iEPdCb0XfnzwdIoqYEOBFBgBh\n9ccsKMn3c+8Vgiu0MGXsPWwm\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@imageon-cc2e2.iam.gserviceaccount.com",
  client_id: "114126417811598938971",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40imageon-cc2e2.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: "imageon-cc2e2"
  });
}

export const auth = getAuth();
export const db = getFirestore();

export const firebaseConfig = {
  apiKey: "AIzaSyBoiSyJdsWHqm_Zb3mZ8VXbW0t6LQ5vFHw",
  authDomain: "imageon-cc2e2.firebaseapp.com",
  projectId: "imageon-cc2e2",
  storageBucket: "imageon-cc2e2.firebasestorage.app",
  messagingSenderId: "480920431317",
  appId: "1:480920431317:web:29debb14e94ceb6758905c",
  measurementId: "G-HM07DQR22Z"
}; 