import { ProfessionalsContextType } from "./interfaces";

export const defaultProfessionalsContext: ProfessionalsContextType = {
  professionals: [],
  availability: [],
  loading: false,
  error: null,
  fetchProfessionals: async () => {},
  fetchAvailability: async () => {},
  createProfessional: async () => undefined,
  updateProfessional: async () => {},
  setProfessionalCatalog: async () => {},
  loadProfessionalCatalog: async () => ({ services: [], agenda: {} }),
  replaceProfessionalCatalog: async () => {},
  deleteProfessional: async () => {},
  setAvailability: async () => {},
};
