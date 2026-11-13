export type PortalView = "home" | "request" | "dailySales" | "menu";

export type LeaveForm = {
  fromDate: Date;
  toDate: Date;
  location: string;
  store: string;
  pay: string;
  reason: string;
};

export type SalesItem = {
  id: string;
  item: string;
  quantity: string;
  totalAmount: string;
};

export type DailySalesForm = {
  salesDate: Date;
  location: string;
  store: string;
  totalAmount: string;
  items: SalesItem[];
};

export const EMPLOYEE = {
  fullName: "Que, Evangeline Tang",
  firstName: "Evangeline",
  initials: "ET",
  employeeId: "10105",
  company: "Optimum / Keywest",
  location: "KIS: HEAD OFFICE",
  store: "TOY KINGDOM: TOY EXPRESS - 0006 SM NORTH EDSA",
};

export const LOCATIONS = ["KIS: HEAD OFFICE", "KIS: NORTH CLUSTER", "KIS: SOUTH CLUSTER"];

export const STORES = [
  "TOY KINGDOM: TOY EXPRESS - 0006 SM NORTH EDSA",
  "TOY KINGDOM: MAIN STORE - SM MEGAMALL",
  "TOY KINGDOM: TOY EXPRESS - SM FAIRVIEW",
];

export const PAY_OPTIONS = ["With Pay", "Without Pay"];

export const DAILY_SALES_ITEMS = [
  "36513 - D.I.Y Gogo",
  "38802N - Maze Challenge",
  "38911 - 8 Science Learning Set",
  "DT1001 - Giant Wooden Car Runaway",
  "DT1007 - Multi Functional Double Easel Board",
  "DT1032 - 95pcs Wooden Train",
  "DT6017 - 50pcs Wooden Building Blocks",
  "HX112 - Colored Doodle Water Magic",
  "HX0688 - Animal Choir",
];

export const REQUEST_MENU = [
  "Overtime",
  "Leave",
  "Change Rest Day",
  "Petty Cash",
  "Liquidation",
  "Reimbursement",
  "Company Loan",
  "Daily Sales",
  "Delivery",
  "Inventory",
  "PO (Stores)",
  "Return",
  "Incident",
  "Checklist",
];

export const HOME_MENU = [
  "About Us",
  "Mission & Vision",
  "HR Policy",
  "Organizational Chart",
  "Phone Directory",
  "Company Events",
  "Announcements",
];

export const initialLeaveForm = (): LeaveForm => {
  const today = new Date();
  const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return {
    fromDate,
    toDate: fromDate,
    location: EMPLOYEE.location,
    store: EMPLOYEE.store,
    pay: "With Pay",
    reason: "",
  };
};

export const initialDailySalesForm = (): DailySalesForm => {
  const today = new Date();
  return {
    salesDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    location: EMPLOYEE.location,
    store: EMPLOYEE.store,
    totalAmount: "",
    items: [],
  };
};

export function salesTotal(items: SalesItem[]) {
  return items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
}

export function daysBetween(fromDate: Date, toDate: Date) {
  const dayMs = 1000 * 60 * 60 * 24;
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime();
  return Math.max(1, Math.floor((end - start) / dayMs) + 1);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
  }).format(date);
}
