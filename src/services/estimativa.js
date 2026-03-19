import { firestore } from "./firebase";
import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";

const COLLECTION_ESTIMATIVAS = "estimativas_safra";
const COLLECTION_HISTORICO = "estimativas_safra_historico";

/**
 * Saves a new estimate for a specific talhão in a specific harvest (safra).
 * Generates a new version and saves it in the history collection without deleting previous records.
 *
 * @param {string} companyId - ID of the company
 * @param {string} safra - e.g., "2026/2027"
 * @param {string} talhaoId - ID of the talhão
 * @param {Object} estimateData - Data of the estimate (area, tons, TCH, etc.)
 */
export const saveEstimate = async (companyId, safra, talhaoId, estimateData) => {
  try {
    const estimateDocId = `${companyId}_${safra.replace('/', '-')}_${talhaoId}`;
    const estimateRef = doc(firestore, COLLECTION_ESTIMATIVAS, estimateDocId);

    // Check if it exists to increment version
    const estimateSnap = await getDoc(estimateRef);
    let version = 1;

    if (estimateSnap.exists()) {
      const currentData = estimateSnap.data();
      version = (currentData.version || 0) + 1;
    }

    const newEstimateData = {
      companyId,
      safra,
      talhaoId,
      ...estimateData,
      version,
      updatedAt: serverTimestamp(),
    };

    // Save/Update current estimate
    await setDoc(estimateRef, newEstimateData);

    // Add to history
    await addDoc(collection(firestore, COLLECTION_HISTORICO), {
      ...newEstimateData,
      estimateDocId, // Reference to current estimate
      createdAt: serverTimestamp()
    });

    return { success: true, version };
  } catch (error) {
    console.error("Error saving estimate:", error);
    throw error; // Let the UI catch and display the exact permission error
  }
};

/**
 * Gets all estimates for a specific company and harvest.
 */
export const getAllEstimates = async (companyId, safra) => {
  try {
    const q = query(
      collection(firestore, COLLECTION_ESTIMATIVAS),
      where("companyId", "==", companyId),
      where("safra", "==", safra)
    );
    const querySnapshot = await getDocs(q);
    const estimates = [];
    querySnapshot.forEach((doc) => {
      estimates.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, data: estimates };
  } catch (error) {
    console.error("Error getting all estimates:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Gets the current estimate for a specific talhão and harvest.
 */
export const getEstimate = async (companyId, safra, talhaoId) => {
  try {
    const estimateDocId = `${companyId}_${safra.replace('/', '-')}_${talhaoId}`;
    const estimateRef = doc(firestore, COLLECTION_ESTIMATIVAS, estimateDocId);
    const estimateSnap = await getDoc(estimateRef);

    if (estimateSnap.exists()) {
      return { success: true, data: estimateSnap.data() };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error("Error getting estimate:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Gets the entire history of estimates for a specific talhão and harvest.
 */
export const getEstimateHistory = async (companyId, safra, talhaoId) => {
  try {
    const q = query(
      collection(firestore, COLLECTION_HISTORICO),
      where("companyId", "==", companyId),
      where("safra", "==", safra),
      where("talhaoId", "==", talhaoId)
    );

    const querySnapshot = await getDocs(q);
    const history = [];
    querySnapshot.forEach((doc) => {
      history.push({ id: doc.id, ...doc.data() });
    });

    // Sort by version descending
    history.sort((a, b) => b.version - a.version);

    return { success: true, data: history };
  } catch (error) {
    console.error("Error getting estimate history:", error);
    return { success: false, error: error.message };
  }
};
