export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  addressLine1?: string;
  city?: string;
  postcode?: string;
}

export interface Plan {
  _id: string;
  name: string;
  price: number;
  isMonthly: boolean;
  maxDocuments: number;
  maxFileSize: number;
  maxUrls: number;
  isActive: boolean;
  isDefault?: boolean;
}

export interface UserPlan {
  _id: string;
  clientId: string;
  planId: Plan;
  startDate: Date;
  expiryDate: Date;
  isActive: boolean;
}

export interface LoaderData {
  plan: Plan;
  user: User;
  currentPlan?: UserPlan;
  error?: string;
  US_STATES: string[];
  COUNTRIES: Array<{
    code: string;
    name: string;
  }>;
} 