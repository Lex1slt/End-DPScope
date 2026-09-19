import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nf = new Intl.NumberFormat("zh-CN");
export function fmt(n: number | undefined | null): string {
  return nf.format(n ?? 0);
}
