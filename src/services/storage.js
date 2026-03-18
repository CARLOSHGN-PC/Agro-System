import { ref, uploadBytes, getDownloadURL, uploadString } from "firebase/storage";
import { storage } from "./firebase";

export const uploadFile = async (path, file) => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

export const uploadJson = async (path, jsonObject) => {
  const storageRef = ref(storage, path);
  const jsonString = JSON.stringify(jsonObject);
  await uploadString(storageRef, jsonString, "raw", {
    contentType: "application/json",
  });
  return await getDownloadURL(storageRef);
};
