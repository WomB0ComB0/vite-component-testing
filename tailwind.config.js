import { nextui } from "@nextui-org/react";

/** @type {import('tailwindcss').Config} */
export const content = [
  '/index.html',
  '/src/**/*.{ts, tsx, js, jsx}',
  "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}"
];
export const theme = {
  extend: {},
};
export const darkMode = 'class';
export const plugins = [nextui()];

