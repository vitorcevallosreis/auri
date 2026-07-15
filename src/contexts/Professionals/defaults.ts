import { ProfessionalsContextType } from "./interfaces";

export const defaultProfessionalsContext: ProfessionalsContextType = {
  professionals: [],
  availability: [],
  loading: false,
  error: null,
  fetchProfessionals: async () => {},
  fetchAvailability: async () => {},
  createProfessional: async () => {},
  updateProfessional: async () => {},
  deleteProfessional: async () => {},
  setAvailability: async () => {},
};
