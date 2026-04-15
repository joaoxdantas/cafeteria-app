export interface Drink {
  id: string;
  name: string;
  category?: string;
  espresso_shots: number;
  leite: boolean;
  foam: number; // 0=none, 1=latte, 2=cappuccino, 3=macchiato
  chocolate: number; // 0-3
  sprinkles: boolean;
  chai: number; // 0-3
  whipped_cream: boolean;
  hot_water: boolean;
  layer_order: string[];
  createdAt: string;
  sortOrder?: number;
  available?: boolean;
  enabledConfigurations?: {
    milk?: boolean;
    sugar?: boolean;
    equal?: boolean;
    syrup?: boolean;
    size?: boolean;
  };
}

export type OrderStatus = 'pending' | 'completed';
export type MilkType = 'full cream' | 'lactose free' | 'skinny' | 'almond' | 'oat' | 'soy';
export type DrinkSize = 'Piccolo' | 'Small' | 'Medium' | 'Large';

export interface Order {
  id: string;
  customer_name: string;
  drink_id: string;
  drink_name: string;
  drink_snapshot: Drink;
  milk_type: MilkType;
  size: DrinkSize;
  notes: string;
  sugar: number;
  equal: number;
  syrup: string;
  barista_espresso_shots_needed: number;
  barista_milk_needed: boolean;
  status: OrderStatus;
  timestamp: string;
  queueIndex?: number;
}

export interface AppSettings {
  isSizeSelectionEnabled: boolean;
}

export interface Shop {
  id: string;
  name: string;
  categories?: string[];
  isMaster?: boolean;
  createdAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

